"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CATALOG_PRODUCT_SELECT,
  formatPrice,
  mapCatalogProduct,
  numeric,
  type CatalogProductRow,
  type StoreProduct,
} from "@/data/catalog-types";
import { createClient } from "@/utils/supabase/client";
import { PageHeading } from "./page-heading";
import { Icon } from "./icon";
import { CatalogImage } from "./catalog-image";
import { useStorefront } from "./storefront-provider";

type CartLine = {
  variantId: string;
  product: StoreProduct;
  variantName: string;
  sku: string;
  price: number;
  stockQuantity: number;
  quantity: number;
};

export function CartPage() {
  const { cart, hydrated, removeFromCart, setQuantity, cartSyncError } = useStorefront();
  const cartKey = Object.keys(cart).join("|");
  const [lines, setLines] = useState<CartLine[]>([]);
  const [unavailableIds, setUnavailableIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!hydrated || !cartKey) {
        setLines([]);
        setUnavailableIds([]);
        setError(null);
        setLoading(false);
        return;
      }

      void (async () => {
        setLoading(true);
        setError(null);
        try {
          const variantIds = cartKey.split("|");
          const supabase = createClient();
          const variantResult = await supabase
            .from("product_variants")
            .select("id,product_id,sku,name,price_inr,stock_quantity")
            .in("id", variantIds);
          if (variantResult.error) throw variantResult.error;

          const variants = variantResult.data ?? [];
          const productIds = Array.from(new Set(variants.map((variant) => variant.product_id)));
          const productResult = productIds.length
            ? await supabase
                .from("catalog_products")
                .select(CATALOG_PRODUCT_SELECT)
                .in("id", productIds)
            : { data: [], error: null };
          if (productResult.error) throw productResult.error;

          const products = new Map(
            ((productResult.data ?? []) as CatalogProductRow[]).map((row) => [
              row.id,
              mapCatalogProduct(row),
            ]),
          );
          const available = new Set<string>();
          const nextLines: CartLine[] = [];
          const quantityCorrections: Array<{ variantId: string; quantity: number }> = [];
          for (const variant of variants) {
            const product = products.get(variant.product_id);
            if (!product) continue;
            if (variant.stock_quantity < 1) {
              quantityCorrections.push({ variantId: variant.id, quantity: 0 });
              continue;
            }
            available.add(variant.id);
            nextLines.push({
              variantId: variant.id,
              product,
              variantName: variant.name,
              sku: variant.sku,
              price: variant.price_inr === null ? product.price : numeric(variant.price_inr),
              stockQuantity: variant.stock_quantity,
              quantity: Math.min(cart[variant.id] ?? 0, variant.stock_quantity),
            });
            if ((cart[variant.id] ?? 0) > variant.stock_quantity) {
              quantityCorrections.push({ variantId: variant.id, quantity: variant.stock_quantity });
            }
          }
          if (!cancelled) {
            setLines(nextLines);
            setUnavailableIds(variantIds.filter((id) => !available.has(id)));
            quantityCorrections.forEach(({ variantId, quantity }) => setQuantity(variantId, quantity));
          }
        } catch (cause) {
          console.error("Could not load the current Supabase cart catalog:", cause);
          if (!cancelled) setError("Cart products could not be checked against current Supabase inventory.");
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [cartKey, cart, hydrated, setQuantity]);

  return (
    <>
      <PageHeading
        eyebrow="Your selection"
        title="Shopping cart"
      description="Your cart is stored in this browser for guests and synchronized to your account when you sign in."
      />
      {!hydrated || loading ? (
        <div className="sb-empty-page"><p>Checking your cart against current catalog data…</p></div>
      ) : error ? (
        <div className="sb-empty-page" role="alert">
          <h2>Cart catalog unavailable</h2><p>{error} Apply the catalog migration and check public read policies.</p>
        </div>
      ) : lines.length ? (
        <>
          {cartSyncError && <div className="sb-prototype-banner" role="status">{cartSyncError}</div>}
          {unavailableIds.length > 0 && (
            <div className="sb-prototype-banner" role="status">
              Some saved cart options are no longer published or available. Remove them below.
            </div>
          )}
          <div className="sb-cart-layout">
            <section aria-label="Cart items" className="sb-cart-list">
              {lines.map((line) => (
                <article className="sb-cart-item" key={line.variantId}>
                  <Link className="sb-cart-thumb" href={`/products/${line.product.slug}`}>
                    {line.product.images[0] ? (
                      <CatalogImage alt={line.product.images[0].alt} sizes="120px" src={line.product.images[0].url} />
                    ) : <span className="sb-product-image-placeholder" />}
                  </Link>
                  <div className="sb-cart-item-copy">
                    <span>{line.product.category}</span>
                    <Link href={`/products/${line.product.slug}`}>{line.product.name}</Link>
                    <span>{line.variantName} · SKU {line.sku}</span>
                    <strong>{formatPrice(line.price)}</strong>
                    <span className={`sb-stock${line.stockQuantity > 0 && line.stockQuantity < 5 ? " is-low" : ""}`}>
                      {line.stockQuantity > 0 ? `${line.stockQuantity} available` : "Out of stock"}
                    </span>
                  </div>
                  <div className="sb-cart-quantity" aria-label={`Quantity for ${line.product.name}`}>
                    <button aria-label={`Decrease ${line.product.name} quantity`} onClick={() => setQuantity(line.variantId, line.quantity - 1)} type="button"><Icon name="minus" size={16} /></button>
                    <span>{line.quantity}</span>
                    <button aria-label={`Increase ${line.product.name} quantity`} disabled={line.quantity >= line.stockQuantity} onClick={() => setQuantity(line.variantId, line.quantity + 1)} type="button"><Icon name="plus" size={16} /></button>
                  </div>
                  <button aria-label={`Remove ${line.product.name} from cart`} className="sb-cart-remove" onClick={() => removeFromCart(line.variantId)} type="button"><Icon name="trash" size={18} /></button>
                </article>
              ))}
              {unavailableIds.map((id) => (
                <article className="sb-cart-item" key={id}>
                  <p>This saved variant is not currently published.</p>
                  <button className="sb-cart-remove" aria-label="Remove unavailable variant" onClick={() => removeFromCart(id)} type="button"><Icon name="trash" size={18} /></button>
                </article>
              ))}
            </section>
            <aside className="sb-order-summary">
              <span className="sb-eyebrow">CART TOTAL</span>
              <h2>{lines.reduce((sum, line) => sum + line.quantity, 0)} items</h2>
              <div className="sb-cart-subtotal"><span>Subtotal</span><strong>{formatPrice(lines.reduce((sum, line) => sum + line.price * line.quantity, 0))}</strong></div>
              <p>Coupons, shipping, tax and final payable amount are calculated by the checkout service from current database prices.</p>
              <Link className="sb-button sb-button-primary" href="/checkout">Continue to checkout <Icon name="arrow" size={17} /></Link>
              <Link className="sb-text-link" href="/products">Continue browsing <Icon name="arrow" size={17} /></Link>
            </aside>
          </div>
        </>
      ) : (
        <div className="sb-empty-page"><span className="sb-empty-icon"><Icon name="cart" size={25} /></span><h2>Your cart is empty.</h2><p>Add an available product variant to save it here.</p><Link className="sb-button sb-button-primary" href="/products">Explore products <Icon name="arrow" size={18} /></Link></div>
      )}
    </>
  );
}
