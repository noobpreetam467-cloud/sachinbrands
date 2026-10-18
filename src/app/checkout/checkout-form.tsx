"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  CATALOG_PRODUCT_SELECT,
  formatPrice,
  mapCatalogProduct,
  numeric,
  type CatalogProductRow,
  type StoreProduct,
} from "@/data/catalog-types";
import { Icon } from "@/components/storefront/icon";
import { useStorefront } from "@/components/storefront/storefront-provider";
import { loadRazorpay } from "@/utils/razorpay-client";
import { createClient } from "@/utils/supabase/client";
import { previewCheckout, saveAddress, type AddressInput, type CheckoutTotals } from "./actions";

export type CheckoutAddress = {
  id: string;
  recipientName: string;
  phone: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pinCode: string;
  isDefault: boolean;
};

type CheckoutLine = {
  variantId: string;
  product: StoreProduct;
  variantName: string;
  sku: string;
  unitPrice: number;
  quantity: number;
};

type CheckoutConfig = {
  cod_enabled: boolean;
  razorpay_enabled: boolean;
  shipping_fee_inr: number;
  free_shipping_threshold_inr: number | null;
  tax_rate_percent: number;
};

const emptyAddress: AddressInput = {
  id: null,
  recipientName: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pinCode: "",
  isDefault: false,
};

export default function CheckoutForm({
  accountEmail,
  initialAddresses,
  config,
  setupErrors,
}: {
  accountEmail: string;
  initialAddresses: CheckoutAddress[];
  config: CheckoutConfig;
  setupErrors: string[];
}) {
  const router = useRouter();
  const { cart, hydrated, clearCart, cartSyncError } = useStorefront();
  const items = useMemo(
    () => Object.entries(cart)
      .filter(([, quantity]) => Number.isInteger(quantity) && quantity > 0)
      .map(([variant_id, quantity]) => ({ variant_id, quantity })),
    [cart],
  );
  const cartKey = items.map((item) => `${item.variant_id}:${item.quantity}`).join("|");
  const [addresses, setAddresses] = useState(initialAddresses);
  const [cartLines, setCartLines] = useState<CheckoutLine[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState(
    initialAddresses.find((address) => address.isDefault)?.id ?? initialAddresses[0]?.id ?? "",
  );
  const [draft, setDraft] = useState<AddressInput>(emptyAddress);
  const [editingAddress, setEditingAddress] = useState(initialAddresses.length === 0);
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<"cod" | "razorpay" | "">("");
  const [couponDraft, setCouponDraft] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState("");
  const [totals, setTotals] = useState<CheckoutTotals | null>(null);
  const [loadingTotals, setLoadingTotals] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingOrderRef, setPendingOrderRef] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const checkoutKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!hydrated || !items.length) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setLoadingTotals(true);
      void previewCheckout(items, appliedCoupon).then((result) => {
        if (cancelled) return;
        if (result.error !== null) {
          setError(result.error);
          setTotals(null);
        } else {
          setError(null);
          setTotals(result.data);
        }
      }).catch((cause: unknown) => {
        console.error("Could not refresh checkout totals:", cause);
        if (!cancelled) setError("Order totals could not be checked. Please try again.");
      }).finally(() => {
        if (!cancelled) setLoadingTotals(false);
      });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [hydrated, cartKey, appliedCoupon, items]);

  useEffect(() => {
    if (!hydrated || !items.length) return;
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void (async () => {
        setCatalogError(null);
        try {
          const supabase = createClient();
          const variantsResult = await supabase
            .from("product_variants")
            .select("id,product_id,sku,name,price_inr")
            .in("id", items.map((item) => item.variant_id));
          if (variantsResult.error) throw variantsResult.error;
          const productIds = Array.from(new Set((variantsResult.data ?? []).map((variant) => variant.product_id)));
          const productsResult = productIds.length
            ? await supabase.from("catalog_products").select(CATALOG_PRODUCT_SELECT).in("id", productIds)
            : { data: [], error: null };
          if (productsResult.error) throw productsResult.error;
          const products = new Map(
            ((productsResult.data ?? []) as CatalogProductRow[]).map((row) => [row.id, mapCatalogProduct(row)]),
          );
          const variants = new Map((variantsResult.data ?? []).map((variant) => [variant.id, variant]));
          const nextLines: CheckoutLine[] = [];
          for (const item of items) {
            const variant = variants.get(item.variant_id);
            const product = variant ? products.get(variant.product_id) : null;
            if (!variant || !product) continue;
            nextLines.push({
              variantId: variant.id,
              product,
              variantName: variant.name,
              sku: variant.sku,
              unitPrice: variant.price_inr === null ? product.price : numeric(variant.price_inr),
              quantity: item.quantity,
            });
          }
          if (!cancelled) setCartLines(nextLines);
        } catch (cause) {
          console.error("Could not load checkout cart details:", cause);
          if (!cancelled) {
            setCatalogError("One or more cart items could not be loaded from the published catalog.");
            setCartLines([]);
          }
        }
      })();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [hydrated, cartKey, items]);

  function updateDraft<K extends keyof AddressInput>(key: K, value: AddressInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function beginEdit(address?: CheckoutAddress) {
    setDraft(address ? {
      id: address.id,
      recipientName: address.recipientName,
      phone: address.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      state: address.state,
      pinCode: address.pinCode,
      isDefault: address.isDefault,
    } : emptyAddress);
    setEditingAddress(true);
  }

  async function handleSaveAddress(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingAddress(true);
    setError(null);
    try {
      const result = await saveAddress(draft);
      if (result.error !== null) {
        setError(result.error);
        setSavingAddress(false);
        return;
      }
      const saved: CheckoutAddress = {
        ...draft,
        id: result.data,
        phone: draft.phone.replace(/[\s()-]/g, ""),
        isDefault: draft.isDefault || addresses.length === 0,
      };
      setAddresses((current) => [
        ...current.filter((address) => address.id !== saved.id),
      ].map((address) => saved.isDefault ? { ...address, isDefault: false } : address).concat(saved));
      setSelectedAddressId(saved.id);
      setEditingAddress(false);
      setError(null);
    } catch (cause) {
      console.error("Could not save shipping address:", cause);
      setError("We couldn't save this address. Please try again.");
    } finally {
      setSavingAddress(false);
    }
  }

  async function applyCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const code = couponDraft.trim();
    if (!code) {
      setCouponMessage("Enter a coupon code first.");
      return;
    }
    setLoadingTotals(true);
    setCouponMessage(null);
    try {
      const result = await previewCheckout(items, code);
      if (result.error !== null) {
        setCouponMessage(result.error);
        return;
      }
      setAppliedCoupon(code);
      setCouponDraft(code);
      setTotals(result.data);
      setError(null);
      setCouponMessage(`Coupon ${result.data.coupon_code ?? code.toUpperCase()} applied.`);
    } catch (cause) {
      console.error("Could not validate coupon:", cause);
      setCouponMessage("We couldn't check this coupon. Please try again.");
    } finally {
      setLoadingTotals(false);
    }
  }

  async function placeOrder() {
    if (busy || !selectedAddressId || !paymentMethod || !totals || !items.length) return;
    setBusy(true);
    setError(null);
    setPendingOrderRef(null);
    try {
      if (paymentMethod === "razorpay") {
        const loaded = await loadRazorpay();
        if (!loaded || !window.Razorpay) {
          throw new Error("Razorpay Checkout could not be loaded. No order or payment was created.");
        }
      }
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addressId: selectedAddressId,
          checkoutKey: checkoutKeyRef.current ?? (checkoutKeyRef.current = window.crypto.randomUUID()),
          paymentMethod,
          items,
          couponCode: appliedCoupon,
        }),
      });
      const result = await response.json() as {
        error?: string;
        order?: { id?: string; order_number?: string; total_inr?: number };
        razorpay?: {
          keyId: string;
          orderId: string;
          amount: number;
          currency: string;
          name: string;
          description: string;
          prefill: { name: string; email: string };
        };
      };
      if (!response.ok || !result.order?.id || !result.order.order_number) {
        if (!response.ok) checkoutKeyRef.current = null;
        throw new Error(result.error ?? "We couldn't place your order.");
      }

      if (paymentMethod === "cod") {
        clearCart();
        checkoutKeyRef.current = null;
        router.replace(`/order-confirmation?ref=${encodeURIComponent(result.order.order_number)}`);
        return;
      }

      if (!result.razorpay) {
        setPendingOrderRef(result.order.order_number);
        throw new Error("Razorpay did not return a payment session. Check this order's status before retrying.");
      }
      if (!window.Razorpay) {
        setPendingOrderRef(result.order.order_number);
        throw new Error("A payment order is pending, but the secure payment window is unavailable. Check its status before retrying.");
      }
      const pendingOrderId = result.order.id;
      const orderNumber = result.order.order_number;
      let verificationStarted = false;
      const checkout = new window.Razorpay({
        key: result.razorpay.keyId,
        amount: result.razorpay.amount,
        currency: result.razorpay.currency,
        name: result.razorpay.name,
        description: result.razorpay.description,
        order_id: result.razorpay.orderId,
        prefill: result.razorpay.prefill,
        handler: (paymentResult) => {
          verificationStarted = true;
          void (async () => {
            try {
              const verification = await fetch("/api/checkout/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: pendingOrderId, ...paymentResult }),
              });
              const verificationResult = await verification.json() as { error?: string; verified?: boolean };
              if (!verification.ok || verificationResult.verified !== true) {
                throw new Error(verificationResult.error ?? "Payment verification is still processing.");
              }
              clearCart();
              checkoutKeyRef.current = null;
              setPendingOrderRef(null);
              router.replace(`/order-confirmation?ref=${encodeURIComponent(orderNumber)}`);
            } catch (cause) {
              console.error("Razorpay returned, but server verification did not complete:", cause);
              setPendingOrderRef(orderNumber);
              setError(cause instanceof Error ? cause.message : "Payment verification is still processing. Do not pay again.");
              setBusy(false);
            }
          })();
        },
        modal: {
          ondismiss: () => {
            if (verificationStarted) return;
            setPendingOrderRef(orderNumber);
            setError("The payment window closed before a verified result was received. The order remains pending; no successful payment is assumed.");
            setBusy(false);
          },
        },
      });
      checkout.on("payment.failed", (event) => {
        setError(event.error?.description ?? "Razorpay could not complete this payment.");
      });
      try {
        checkout.open();
      } catch (cause) {
        console.error("Could not open Razorpay Checkout:", cause);
        setPendingOrderRef(orderNumber);
        setError("The payment window could not be opened. The order remains pending; check its status before retrying.");
        setBusy(false);
      }
    } catch (cause) {
      console.error("Checkout request failed:", cause);
      setError(cause instanceof Error ? cause.message : "We couldn't place your order. Please try again.");
      setBusy(false);
    }
  }

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const availableMethods = [
    config.cod_enabled ? "cod" : null,
    config.razorpay_enabled ? "razorpay" : null,
  ].filter((method): method is "cod" | "razorpay" => method !== null);

  return (
    <section className="sb-checkout" aria-label="Checkout">
      {setupErrors.map((message) => <p className="sb-checkout-alert" key={message} role="alert">{message}</p>)}
      {cartSyncError && <p className="sb-checkout-alert" role="status">{cartSyncError}</p>}
      {error && <p className="sb-checkout-alert" role="alert">{error} {pendingOrderRef && <Link href={`/order-confirmation?ref=${encodeURIComponent(pendingOrderRef)}`}>Check order status</Link>}</p>}

      {!hydrated ? (
        <div className="sb-checkout-panel">Loading your cart…</div>
      ) : items.length === 0 ? (
        <div className="sb-checkout-panel sb-checkout-empty">
          <h2>Your cart is empty</h2>
          <p>Add products before continuing to checkout.</p>
          <Link className="sb-button sb-button-primary" href="/products">Explore products</Link>
        </div>
      ) : (
        <>
          <ol className="sb-checkout-steps" aria-label="Checkout progress">
            {["Contact", "Address", "Payment", "Review"].map((label, index) => (
              <li className={step === index + 1 ? "is-current" : step > index + 1 ? "is-complete" : ""} key={label}>
                <span>{step > index + 1 ? <Icon name="check" size={15} /> : index + 1}</span>{label}
              </li>
            ))}
          </ol>

          <div className="sb-checkout-columns">
            <div className="sb-checkout-main">
              {step === 1 && (
                <section className="sb-checkout-panel">
                  <span className="sb-eyebrow">STEP 1 OF 4</span>
                  <h2>Contact information</h2>
                  <label className="sb-checkout-field">
                    <span>Email address</span>
                    <input autoComplete="email" readOnly value={accountEmail} />
                  </label>
                  <p>Order updates will be associated with your signed-in account.</p>
                  <button className="sb-button sb-button-primary" onClick={() => setStep(2)} type="button">
                    Continue to address <Icon name="arrow" size={17} />
                  </button>
                </section>
              )}

              {step === 2 && (
                <section className="sb-checkout-panel">
                  <span className="sb-eyebrow">STEP 2 OF 4</span>
                  <h2>Shipping address</h2>
                  {addresses.length > 0 && !editingAddress && (
                    <div className="sb-address-list">
                      {addresses.map((address) => (
                        <label className={`sb-address-option${selectedAddressId === address.id ? " is-selected" : ""}`} key={address.id}>
                          <input
                            checked={selectedAddressId === address.id}
                            name="shippingAddress"
                            onChange={() => setSelectedAddressId(address.id)}
                            type="radio"
                            value={address.id}
                          />
                          <span>
                            <strong>{address.recipientName}</strong>{address.isDefault && <em>Default</em>}
                            <small>{address.phone} · {address.line1}{address.line2 ? `, ${address.line2}` : ""}</small>
                            <small>{address.city}, {address.state} {address.pinCode}</small>
                          </span>
                          <button aria-label={`Edit address for ${address.recipientName}`} onClick={(event) => { event.preventDefault(); beginEdit(address); }} type="button">Edit</button>
                        </label>
                      ))}
                    </div>
                  )}
                  {!editingAddress && (
                    <button className="sb-text-link sb-add-address" onClick={() => beginEdit()} type="button">
                      <Icon name="plus" size={16} /> Add a new address
                    </button>
                  )}
                  {editingAddress && (
                    <form className="sb-address-form" onSubmit={(event) => void handleSaveAddress(event)}>
                      <label><span>Recipient name</span><input autoComplete="name" maxLength={100} onChange={(event) => updateDraft("recipientName", event.target.value)} required value={draft.recipientName} /></label>
                      <label><span>Indian mobile number</span><input autoComplete="tel-national" inputMode="numeric" maxLength={14} onChange={(event) => updateDraft("phone", event.target.value)} pattern="[\s0-9()+-]{10,14}" placeholder="9876543210" required value={draft.phone} /></label>
                      <label className="is-wide"><span>Address line 1</span><input autoComplete="address-line1" maxLength={200} onChange={(event) => updateDraft("line1", event.target.value)} required value={draft.line1} /></label>
                      <label className="is-wide"><span>Address line 2 (optional)</span><input autoComplete="address-line2" maxLength={200} onChange={(event) => updateDraft("line2", event.target.value)} value={draft.line2} /></label>
                      <label><span>City</span><input autoComplete="address-level2" maxLength={100} onChange={(event) => updateDraft("city", event.target.value)} required value={draft.city} /></label>
                      <label><span>State</span><input autoComplete="address-level1" maxLength={100} onChange={(event) => updateDraft("state", event.target.value)} required value={draft.state} /></label>
                      <label><span>PIN code</span><input autoComplete="postal-code" inputMode="numeric" maxLength={6} onChange={(event) => updateDraft("pinCode", event.target.value)} pattern="[1-9][0-9]{5}" required value={draft.pinCode} /></label>
                      <label className="sb-default-address"><input checked={draft.isDefault} onChange={(event) => updateDraft("isDefault", event.target.checked)} type="checkbox" /><span>Save as my default address</span></label>
                      <div className="sb-address-form-actions">
                        <button className="sb-button sb-button-primary" disabled={savingAddress} type="submit">{savingAddress ? "Saving…" : "Save address"}</button>
                        <button className="sb-button sb-button-outline" onClick={() => { setEditingAddress(false); setDraft(emptyAddress); }} type="button">Cancel</button>
                      </div>
                    </form>
                  )}
                  <div className="sb-checkout-step-actions">
                    <button className="sb-button sb-button-outline" onClick={() => setStep(1)} type="button">Back</button>
                    <button className="sb-button sb-button-primary" disabled={!selectedAddressId || editingAddress} onClick={() => setStep(3)} type="button">Continue to payment <Icon name="arrow" size={17} /></button>
                  </div>
                </section>
              )}

              {step === 3 && (
                <section className="sb-checkout-panel">
                  <span className="sb-eyebrow">STEP 3 OF 4</span>
                  <h2>Delivery and payment</h2>
                  <div className="sb-checkout-methods">
                    {config.cod_enabled && (
                      <label className={`sb-checkout-method${paymentMethod === "cod" ? " is-selected" : ""}`}>
                        <input checked={paymentMethod === "cod"} name="paymentMethod" onChange={() => setPaymentMethod("cod")} type="radio" value="cod" />
                        <span><strong>Cash on Delivery</strong><small>Pay when your order arrives.</small></span>
                      </label>
                    )}
                    {config.razorpay_enabled && (
                      <label className={`sb-checkout-method${paymentMethod === "razorpay" ? " is-selected" : ""}`}>
                        <input checked={paymentMethod === "razorpay"} name="paymentMethod" onChange={() => setPaymentMethod("razorpay")} type="radio" value="razorpay" />
                        <span><strong>Pay online with Razorpay</strong><small>Secure payment; order confirms after server verification.</small></span>
                      </label>
                    )}
                  </div>
                  {availableMethods.length === 0 && (
                    <p className="sb-checkout-alert" role="status">No payment method is enabled yet. Store settings must enable Cash on Delivery or configure Razorpay.</p>
                  )}
                  <div className="sb-checkout-step-actions">
                    <button className="sb-button sb-button-outline" onClick={() => setStep(2)} type="button">Back</button>
                    <button className="sb-button sb-button-primary" disabled={!paymentMethod || !availableMethods.includes(paymentMethod)} onClick={() => setStep(4)} type="button">Review order <Icon name="arrow" size={17} /></button>
                  </div>
                </section>
              )}

              {step === 4 && (
                <section className="sb-checkout-panel">
                  <span className="sb-eyebrow">STEP 4 OF 4</span>
                  <h2>Review and place order</h2>
                  <div className="sb-checkout-review">
                    <div><strong>Contact</strong><span>{accountEmail}</span><button onClick={() => setStep(1)} type="button">Edit</button></div>
                    <div>
                      <strong>Ship to</strong>
                      <span>{addresses.find((address) => address.id === selectedAddressId)?.recipientName} · {addresses.find((address) => address.id === selectedAddressId)?.line1}, {addresses.find((address) => address.id === selectedAddressId)?.city} {addresses.find((address) => address.id === selectedAddressId)?.pinCode}</span>
                      <button onClick={() => setStep(2)} type="button">Edit</button>
                    </div>
                    <div><strong>Payment</strong><span>{paymentMethod === "cod" ? "Cash on Delivery" : "Razorpay online payment"}</span><button onClick={() => setStep(3)} type="button">Edit</button></div>
                  </div>

                  <form className="sb-coupon-form" onSubmit={(event) => void applyCoupon(event)}>
                    <label htmlFor="checkout-coupon">Coupon code</label>
                    <div><input autoCapitalize="characters" id="checkout-coupon" maxLength={40} onChange={(event) => setCouponDraft(event.target.value)} placeholder="Enter code" value={couponDraft} /><button className="sb-button sb-button-outline" disabled={loadingTotals} type="submit">Apply</button></div>
                    {couponMessage && <p aria-live="polite">{couponMessage}</p>}
                  </form>

                  <button className="sb-button sb-button-outline" onClick={() => setStep(3)} type="button">Back</button>
                  <button
                    className="sb-button sb-button-primary sb-place-order"
                    disabled={busy || loadingTotals || !totals || cartLines.length !== items.length || Boolean(catalogError) || !paymentMethod || !selectedAddressId || setupErrors.length > 0}
                    onClick={() => void placeOrder()}
                    type="button"
                  >
                    {busy ? (paymentMethod === "razorpay" ? "Opening secure payment…" : "Placing order…") : paymentMethod === "cod" ? "Place COD order" : "Continue to secure payment"}
                    {!busy && <Icon name="arrow" size={18} />}
                  </button>
                  <p className="sb-checkout-terms">Your total and stock are checked again by the server before any order is created.</p>
                </section>
              )}
            </div>

            <aside className="sb-order-summary sb-checkout-summary">
              <span className="sb-eyebrow">ORDER SUMMARY</span>
              <h2>{itemCount} {itemCount === 1 ? "item" : "items"}</h2>
              {catalogError && <p className="sb-checkout-alert" role="alert">{catalogError}</p>}
              {cartLines.map((line) => (
                <div className="sb-checkout-summary-item" key={line.variantId}>
                  <span><strong>{line.product.name}</strong><small>{line.variantName} · Qty {line.quantity}</small></span>
                  <b>{formatPrice(line.unitPrice * line.quantity)}</b>
                </div>
              ))}
              <dl>
                <div><dt>Subtotal</dt><dd>{totals ? formatPrice(totals.subtotal_inr) : "—"}</dd></div>
                <div><dt>Discount{totals?.coupon_code ? ` (${totals.coupon_code})` : ""}</dt><dd>{totals ? `−${formatPrice(totals.discount_inr)}` : "—"}</dd></div>
                <div><dt>Shipping</dt><dd>{totals ? (totals.shipping_inr === 0 ? "Free" : formatPrice(totals.shipping_inr)) : "—"}</dd></div>
                <div><dt>Tax{totals?.tax_rate_percent ? ` (${totals.tax_rate_percent}%)` : ""}</dt><dd>{totals ? formatPrice(totals.tax_inr) : "—"}</dd></div>
                <div className="is-total"><dt>Total payable</dt><dd>{loadingTotals ? "Updating…" : totals ? formatPrice(totals.total_inr) : "—"}</dd></div>
              </dl>
              {!totals && !loadingTotals && <p>Totals are unavailable until current stock and prices can be verified.</p>}
              <Link className="sb-text-link" href="/cart">Edit cart <Icon name="arrow" size={16} /></Link>
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
