"use client";

import Link from "next/link";
import { ProductCard } from "./product-card";
import { PageHeading } from "./page-heading";
import { Icon } from "./icon";
import { useStorefront } from "./storefront-provider";
import { CatalogStatus } from "./catalog-status";
import { useLiveProducts } from "./catalog-selection";

export function WishlistPage() {
  const { wishlist, hydrated } = useStorefront();
  const result = useLiveProducts(hydrated ? wishlist : []);

  return (
    <>
      <PageHeading eyebrow="Saved for later" title="Your wishlist" description="Saved products follow you across devices when you are signed in; guest saves stay in this browser." />
      {!hydrated || result.loading ? <div className="sb-empty-page"><p>Loading saved products…</p></div> : result.error ? (
        <><CatalogStatus message={result.error} /><div className="sb-empty-page"><p>Wishlist product details need the catalog migration and public read access.</p></div></>
      ) : result.products.length ? (
        <div className="sb-product-grid sb-catalog-grid">{result.products.map((product) => <ProductCard key={product.id} product={product} />)}</div>
      ) : (
        <div className="sb-empty-page"><span className="sb-empty-icon"><Icon name="heart" size={25} /></span><h2>Nothing saved just yet.</h2><p>Tap the heart on a product to save it for later.</p><Link className="sb-button sb-button-primary" href="/products">Find something good <Icon name="arrow" size={18} /></Link></div>
      )}
    </>
  );
}
