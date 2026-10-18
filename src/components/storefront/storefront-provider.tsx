"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/utils/supabase/client";

const STORAGE_KEY = "sachin-brands-demo-commerce-v1";

type StoreState = {
  cart: Record<string, number>;
  wishlist: string[];
  recentlyViewed: string[];
};

type StoreContextValue = StoreState & {
  hydrated: boolean;
  cartSyncError: string | null;
  addToCart: (id: string) => void;
  removeFromCart: (id: string) => void;
  setQuantity: (id: string, quantity: number) => void;
  toggleWishlist: (id: string) => void;
  recordViewed: (id: string) => void;
  clearCart: () => void;
};

const initialState: StoreState = {
  cart: {},
  wishlist: [],
  recentlyViewed: [],
};

const StoreContext = createContext<StoreContextValue | null>(null);

export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const [hydrated, setHydrated] = useState(false);
  const [cartOwner, setCartOwner] = useState<string | null>(null);
  const [wishlistOwner, setWishlistOwner] = useState<string | null>(null);
  const [cartSyncError, setCartSyncError] = useState<string | null>(null);
  const cartRef = useRef(state.cart);
  const wishlistRef = useRef(state.wishlist);
  const guestWishlistRef = useRef<string[]>([]);
  const syncQueueRef = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    cartRef.current = state.cart;
  }, [state.cart]);
  useEffect(() => {
    wishlistRef.current = state.wishlist;
  }, [state.wishlist]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as Partial<StoreState>;
          setState({
            cart:
              parsed.cart && typeof parsed.cart === "object" ? parsed.cart : {},
            wishlist: Array.isArray(parsed.wishlist) ? parsed.wishlist : [],
            recentlyViewed: Array.isArray(parsed.recentlyViewed)
              ? parsed.recentlyViewed.slice(0, 8)
              : [],
          });
          guestWishlistRef.current = Array.isArray(parsed.wishlist)
            ? parsed.wishlist
            : [];
        }
      } catch (error) {
        console.error("Could not restore the local demo shopping state:", error);
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    let active = true;
    let activeUserId: string | null = null;
    const pendingAuthTimers = new Set<number>();
    let supabase: ReturnType<typeof createClient>;
    try {
      supabase = createClient();
    } catch (error) {
      console.error("Supabase cart persistence is unavailable:", error);
      const timeout = window.setTimeout(
        () => setCartSyncError("Supabase is not configured. Your cart is saved only in this browser."),
        0,
      );
      return () => window.clearTimeout(timeout);
    }

    async function loadAccountCart(userId: string | null) {
      if (!active || userId === activeUserId) return;
      activeUserId = userId;
      if (!userId) {
        setCartOwner(null);
        setWishlistOwner(null);
        setState((current) => ({ ...current, wishlist: guestWishlistRef.current }));
        return;
      }

      try {
        const guestItems = Object.entries(cartRef.current).map(([variant_id, quantity]) => ({
          variant_id,
          quantity,
        }));
        if (guestItems.length) {
          const { error: mergeError } = await supabase.rpc("merge_guest_cart", {
            p_items: guestItems,
          });
          if (mergeError) throw mergeError;
        }
        const { data: existingWishlist, error: existingWishlistError } = await supabase
          .from("wishlist_items")
          .select("product_id");
        if (existingWishlistError) throw existingWishlistError;
        const { error: wishlistMergeError } = await supabase.rpc("sync_customer_wishlist", {
          p_product_ids: Array.from(new Set([
            ...guestWishlistRef.current,
            ...wishlistRef.current,
            ...(existingWishlist ?? []).map((item) => item.product_id),
          ])),
        });
        if (wishlistMergeError) throw wishlistMergeError;
        const { data, error } = await supabase
          .from("cart_items")
          .select("variant_id,quantity");
        if (error) throw error;
        const { data: wishlistData, error: wishlistError } = await supabase
          .from("wishlist_items")
          .select("product_id");
        if (wishlistError) throw wishlistError;
        if (!active) return;
        const accountCart = Object.fromEntries(
          (data ?? []).map((item) => [item.variant_id, item.quantity]),
        );
        setState((current) => ({
          ...current,
          cart: accountCart,
          wishlist: (wishlistData ?? []).map((item) => item.product_id),
        }));
        setCartSyncError(null);
        setCartOwner(userId);
        setWishlistOwner(userId);
      } catch (error) {
        activeUserId = null;
        console.error("Could not merge or load the signed-in cart:", error);
        if (active) setCartSyncError("Your signed-in cart could not be loaded or merged. Changes remain in this browser.");
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        activeUserId = null;
        setCartOwner(null);
        setWishlistOwner(null);
        setState((current) => ({ ...current, wishlist: guestWishlistRef.current }));
        return;
      }
      if (session?.user) {
        const userId = session.user.id;
        const timer = window.setTimeout(() => {
          pendingAuthTimers.delete(timer);
          void loadAccountCart(userId);
        }, 0);
        pendingAuthTimers.add(timer);
      }
    });
    void supabase.auth.getUser().then(({ data, error }) => {
      if (error?.name === "AuthSessionMissingError") {
        return loadAccountCart(null);
      }
      if (error) throw error;
      return loadAccountCart(data.user?.id ?? null);
    }).catch((error: unknown) => {
      console.error("Could not read the Supabase session for cart sync:", error);
      if (active) setCartSyncError("Your cart could not be synchronized with your account.");
    });

    return () => {
      active = false;
      pendingAuthTimers.forEach((timer) => window.clearTimeout(timer));
      subscription.unsubscribe();
    };
  }, [hydrated]);

  useEffect(() => {
    if (!wishlistOwner) {
      guestWishlistRef.current = state.wishlist;
      return;
    }
    const productIds = [...state.wishlist];
    syncQueueRef.current = syncQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const supabase = createClient();
        const { error } = await supabase.rpc("sync_customer_wishlist", {
          p_product_ids: productIds,
        });
        if (error) throw error;
      })
      .catch((error: unknown) => {
        console.error("Could not persist signed-in wishlist changes:", error);
        setCartSyncError("Your wishlist could not be synchronized with your account.");
      });
  }, [wishlistOwner, state.wishlist]);

  useEffect(() => {
    if (!cartOwner) return;
    const items = Object.entries(state.cart).map(([variant_id, quantity]) => ({
      variant_id,
      quantity,
    }));
    syncQueueRef.current = syncQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        const supabase = createClient();
        const { error } = await supabase.rpc("sync_cart_items", { p_items: items });
        if (error) throw error;
        setCartSyncError(null);
      })
      .catch((error: unknown) => {
        console.error("Could not persist signed-in cart changes:", error);
        setCartSyncError("Cart changes are saved in this browser but could not be synchronized to your account.");
      });
  }, [cartOwner, state.cart]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
        ...state,
        wishlist: wishlistOwner ? guestWishlistRef.current : state.wishlist,
      }));
    } catch (error) {
      console.error("Could not save the local demo shopping state:", error);
    }
  }, [hydrated, state, wishlistOwner]);

  const addToCart = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      cart: { ...current.cart, [id]: (current.cart[id] ?? 0) + 1 },
    }));
  }, []);

  const removeFromCart = useCallback((id: string) => {
    setState((current) => {
      const cart = { ...current.cart };
      delete cart[id];
      return { ...current, cart };
    });
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    setState((current) => {
      if (quantity <= 0) {
        const cart = { ...current.cart };
        delete cart[id];
        return { ...current, cart };
      }
      return { ...current, cart: { ...current.cart, [id]: quantity } };
    });
  }, []);

  const toggleWishlist = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      wishlist: current.wishlist.includes(id)
        ? current.wishlist.filter((item) => item !== id)
        : [...current.wishlist, id],
    }));
  }, []);

  const recordViewed = useCallback((id: string) => {
    setState((current) => ({
      ...current,
      recentlyViewed: [id, ...current.recentlyViewed.filter((item) => item !== id)].slice(0, 8),
    }));
  }, []);

  const clearCart = useCallback(() => {
    setState((current) => ({ ...current, cart: {} }));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      hydrated,
      cartSyncError,
      addToCart,
      removeFromCart,
      setQuantity,
      toggleWishlist,
      recordViewed,
      clearCart,
    }),
    [state, hydrated, cartSyncError, addToCart, removeFromCart, setQuantity, toggleWishlist, recordViewed, clearCart],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStorefront() {
  const value = useContext(StoreContext);
  if (!value) {
    throw new Error("useStorefront must be used inside StorefrontProvider.");
  }
  return value;
}
