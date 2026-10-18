"use client";

import { useStorefront } from "./storefront-provider";
import { ProductSection } from "./product-section";
import { useLiveProducts } from "./catalog-selection";

export function RecentlyViewed() {
  const { recentlyViewed, hydrated } = useStorefront();
  const result = useLiveProducts(hydrated ? recentlyViewed : []);
  if (!hydrated || !recentlyViewed.length || result.loading || result.error) return null;

  return result.products.length ? (
    <ProductSection eyebrow="Pick up where you left off" title="Recently viewed" products={result.products} />
  ) : null;
}
