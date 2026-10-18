"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { StoreProduct, StoreReview, StoreVariant } from "@/data/catalog-types";
import { formatPrice } from "@/data/catalog-types";
import { Icon } from "./icon";
import { CatalogImage } from "./catalog-image";
import { useStorefront } from "./storefront-provider";
import { createClient } from "@/utils/supabase/client";

export function ProductDetails({
  product,
  variants,
  reviews,
}: {
  product: StoreProduct;
  variants: StoreVariant[];
  reviews: StoreReview[];
}) {
  const router = useRouter();
  const { addToCart, cart, recordViewed, wishlist, toggleWishlist } =
    useStorefront();
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariantId, setSelectedVariantId] = useState(
    variants.find((variant) => variant.stockQuantity > 0)?.id ?? "",
  );
  const saved = wishlist.includes(product.id);
  const selectedVariant = useMemo(
    () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
    [variants, selectedVariantId],
  );
  const stock = selectedVariant?.stockQuantity ?? 0;
  const displayQuantity = Math.min(quantity, Math.max(1, stock));
  const price = selectedVariant?.price ?? product.price;
  const originalPrice = selectedVariant?.originalPrice ?? product.originalPrice;
  const image = product.images[selectedImage] ?? product.images[0];

  useEffect(() => recordViewed(product.id), [product.id, recordViewed]);

  async function addSelectedItem(buyNow: boolean) {
    if (!selectedVariant || stock < 1 || adding) {
      setFeedback("Choose an available variant before adding this item.");
      return;
    }
    if ((cart[selectedVariant.id] ?? 0) + displayQuantity > stock) {
      setFeedback(`Only ${stock} of this variant are currently available.`);
      return;
    }

    setAdding(true);
    setFeedback(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("product_variants")
        .select("stock_quantity")
        .eq("id", selectedVariant.id)
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      const currentStock = data?.stock_quantity ?? 0;
      if ((cart[selectedVariant.id] ?? 0) + displayQuantity > currentStock) {
        setFeedback(
          currentStock > 0
            ? `Only ${currentStock} of this variant are currently available.`
            : "This variant is no longer available.",
        );
        return;
      }
      for (let index = 0; index < displayQuantity; index += 1) {
        addToCart(selectedVariant.id);
      }
      setFeedback(`${product.name} added to your local cart.`);
      if (buyNow) router.push("/cart");
    } catch (error) {
      console.error("Could not validate live product stock:", error);
      setFeedback("Live stock could not be checked. Please try again.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="sb-product-detail">
      <div>
        <div className="sb-detail-image">
          {image ? (
            <CatalogImage
              alt={image.alt}
              priority
              sizes="(max-width: 760px) 100vw, 50vw"
              src={image.url}
            />
          ) : (
            <div className="sb-product-image-placeholder" aria-label="Product image not yet available" />
          )}
        </div>
        {product.images.length > 1 && (
          <div className="sb-product-gallery" aria-label="Product images">
            {product.images.map((item, index) => (
              <button
                aria-label={`Show product image ${index + 1}`}
                aria-pressed={selectedImage === index}
                className="sb-gallery-thumb"
                key={item.url}
                onClick={() => setSelectedImage(index)}
                type="button"
              >
                <CatalogImage alt="" sizes="80px" src={item.url} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sb-detail-copy">
        <Link className="sb-back-link" href={`/categories/${product.categorySlug}`}>
          <Icon name="arrow-left" size={16} /> {product.category}
        </Link>
        <span className="sb-eyebrow">{product.brand}</span>
        <h1>{product.name}</h1>
        {product.rating !== null && product.reviewCount > 0 && (
          <div
            aria-label={`Rated ${product.rating} out of 5 from ${product.reviewCount} reviews`}
            className="sb-rating sb-detail-rating"
          >
            <Icon name="star" size={16} />
            <span>{product.rating}</span>
            <span className="sb-rating-count">({product.reviewCount} reviews)</span>
          </div>
        )}
        <div className="sb-detail-price">
          <strong>{formatPrice(price)}</strong>
          {originalPrice !== null && originalPrice > price && (
            <del>{formatPrice(originalPrice)}</del>
          )}
        </div>
        <p className="sb-detail-description">{product.description}</p>
        {product.sku && <p className="sb-stock">SKU: {selectedVariant?.sku ?? product.sku}</p>}

        {variants.length > 0 && (
          <label className="sb-variant-field">
            <span>Choose an option</span>
            <select
              value={selectedVariantId}
              onChange={(event) => {
                setSelectedVariantId(event.target.value);
                setFeedback(null);
              }}
            >
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id} disabled={variant.stockQuantity < 1}>
                  {Object.values(variant.attributes).join(" · ") || variant.name} · {formatPrice(variant.price ?? product.price)} ·{" "}
                  {variant.stockQuantity > 0 ? `${variant.stockQuantity} available` : "Out of stock"}
                </option>
              ))}
            </select>
          </label>
        )}

        <p className={`sb-stock sb-detail-stock${stock > 0 && stock < 5 ? " is-low" : ""}`}>
          {stock > 0 ? (stock < 5 ? `Only ${stock} left` : "In stock") : "Out of stock"}
        </p>
        <div className="sb-product-quantity">
          <span>Quantity</span>
          <button
            aria-label="Decrease quantity"
            disabled={displayQuantity <= 1}
            onClick={() => setQuantity(Math.max(1, displayQuantity - 1))}
            type="button"
          >
            −
          </button>
          <output aria-live="polite">{displayQuantity}</output>
          <button
            aria-label="Increase quantity"
            disabled={displayQuantity >= stock}
            onClick={() => setQuantity(Math.min(stock, displayQuantity + 1))}
            type="button"
          >
            +
          </button>
        </div>
        <div className="sb-detail-actions">
          <button
            className="sb-button sb-button-primary"
            disabled={adding || !selectedVariant || stock < 1}
            onClick={() => addSelectedItem(false)}
            type="button"
          >
            {adding ? "Adding…" : "Add to cart"} <Icon name="cart" size={18} />
          </button>
          <button
            className="sb-button sb-button-outline"
            disabled={adding || !selectedVariant || stock < 1}
            onClick={() => addSelectedItem(true)}
            type="button"
          >
            Buy now
          </button>
          <button
            aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
            aria-pressed={saved}
            className={`sb-detail-wishlist${saved ? " is-saved" : ""}`}
            onClick={() => toggleWishlist(product.id)}
            type="button"
          >
            <Icon name="heart" />
          </button>
        </div>
        {feedback && <p aria-live="polite" className="sb-detail-feedback">{feedback}</p>}
        <div className="sb-detail-promises">
          <span><Icon name="shield" size={18} /> Secure checkout is not enabled</span>
          <span><Icon name="truck" size={18} /> Shipping estimates coming soon</span>
        </div>
        {Object.keys(product.specifications).length > 0 && (
          <section className="sb-product-specifications">
            <h2>Specifications</h2>
            <dl>
              {Object.entries(product.specifications).map(([label, value]) => (
                <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
              ))}
            </dl>
          </section>
        )}
        {reviews.length > 0 && (
          <section className="sb-product-reviews">
            <h2>Customer reviews</h2>
            {reviews.map((review) => (
              <article key={review.id}>
                <div className="sb-rating"><Icon name="star" size={14} /><span>{review.rating} / 5</span></div>
                {review.title && <h3>{review.title}</h3>}
                {review.body && <p>{review.body}</p>}
                <time dateTime={review.createdAt}>{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(review.createdAt))}</time>
              </article>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
