"use client";

import Link from "next/link";
import { useState } from "react";
import type { StoreProduct } from "@/data/catalog-types";
import { formatPrice } from "@/data/catalog-types";
import { createClient } from "@/utils/supabase/client";
import { Icon } from "./icon";
import { CatalogImage } from "./catalog-image";
import { useStorefront } from "./storefront-provider";

export function ProductCard({ product }: { product: StoreProduct }) {
  const { addToCart, cart, wishlist, toggleWishlist } = useStorefront();
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const saved = wishlist.includes(product.id);
  const inCart = product.defaultVariantId ? (cart[product.defaultVariantId] ?? 0) : 0;
  const stockReached = inCart >= product.defaultVariantStockQuantity;

  async function handleAdd() {
    if (adding || stockReached || !product.defaultVariantId || product.defaultVariantStockQuantity < 1) return;
    const variantId = product.defaultVariantId;
    setAdding(true);
    setFeedback(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("product_variants")
        .select("stock_quantity")
        .eq("id", variantId)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      const available = data?.stock_quantity ?? 0;
      if ((cart[variantId] ?? 0) + 1 > available) {
        setFeedback(available > 0 ? `Only ${available} currently available.` : "This variant is no longer available.");
        return;
      }
      addToCart(variantId);
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1400);
    } catch (error) {
      console.error("Could not validate live stock before adding to cart:", error);
      setFeedback("Live stock could not be checked. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <article className="sb-product-card" data-reveal>
      <div className="sb-product-image">
        <Link aria-label={`View ${product.name}`} className="sb-product-image-link" href={`/products/${product.slug}`}>
          {product.images[0] ? (
            <CatalogImage alt={product.images[0].alt} sizes="(max-width: 640px) 48vw, (max-width: 1024px) 32vw, 25vw" src={product.images[0].url} />
          ) : <span className="sb-product-image-placeholder" aria-label="Product image not yet available" />}
        </Link>
        {product.badge && <span className="sb-product-badge">{product.badge}</span>}
        <button
          aria-label={saved ? `Remove ${product.name} from wishlist` : `Add ${product.name} to wishlist`}
          aria-pressed={saved}
          className={`sb-wishlist-button${saved ? " is-saved" : ""}`}
          onClick={(event) => {
            event.preventDefault();
            toggleWishlist(product.id);
          }}
          type="button"
        >
          <Icon name="heart" size={19} />
        </button>
        {feedback && <p aria-live="polite" className="sb-card-feedback">{feedback}</p>}
      </div>
      <div className="sb-product-info">
        <div className="sb-product-category">{product.category}</div>
        <Link className="sb-product-name" href={`/products/${product.slug}`}>{product.name}</Link>
        {product.rating !== null && product.reviewCount > 0 && (
          <div aria-label={`Rated ${product.rating} out of 5 from ${product.reviewCount} reviews`} className="sb-rating">
            <Icon name="star" size={14} /><span>{product.rating}</span><span className="sb-rating-count">({product.reviewCount})</span>
          </div>
        )}
        <div className="sb-product-purchase-row">
          <div className="sb-product-prices">
            <strong>{formatPrice(product.price)}</strong>
            {product.originalPrice && <del>{formatPrice(product.originalPrice)}</del>}
          </div>
          <span className={`sb-stock${product.stockQuantity > 0 && product.stockQuantity < 5 ? " is-low" : ""}`}>{product.stockQuantity > 0 ? (product.stockQuantity < 5 ? "Low stock" : "In stock") : "Out of stock"}</span>
        </div>
        <button
          className={`sb-add-button${added ? " is-added" : ""}`}
          disabled={adding || stockReached || !product.defaultVariantId || product.defaultVariantStockQuantity < 1}
          onClick={handleAdd}
          type="button"
        >
          {adding ? "Adding…" : added ? "Added to cart" : product.stockQuantity < 1 ? "Out of stock" : stockReached ? "Stock limit reached" : "Add to cart"}
          {!adding && !added && <Icon name="plus" size={17} />}
          {added && <Icon name="check" size={17} />}
        </button>
      </div>
    </article>
  );
}
