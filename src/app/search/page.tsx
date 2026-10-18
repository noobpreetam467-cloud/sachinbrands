import type { Metadata } from "next";
import { CatalogStatus, CatalogUnavailable } from "@/components/storefront/catalog-status";
import { PageHeading } from "@/components/storefront/page-heading";
import { ProductCard } from "@/components/storefront/product-card";
import { StorefrontLayout } from "@/components/storefront/storefront-layout";
import { getProducts } from "@/data/catalog";

export const metadata: Metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const query = q.trim();
  const result = query ? await getProducts({ query, pageSize: 48 }) : null;

  return (
    <StorefrontLayout>
      <PageHeading
        eyebrow="Search the collection"
        title={query ? `Results for “${query}”` : "Search"}
        description={query ? "Search published product names, brands, and category names." : "Search the live Sachin Brands catalog."}
      />
      {result?.error && (
        <CatalogStatus message="Supabase search is unavailable. Apply the catalog migration and confirm public read policies." />
      )}
      {!query ? (
        <div className="sb-empty-page"><h2>Search products, brands, or categories.</h2></div>
      ) : result?.error ? (
        <CatalogUnavailable />
      ) : result?.data.products.length ? (
        <>
          <p className="sb-catalog-toolbar"><span>{result.data.total} matching products</span></p>
          <div className="sb-product-grid sb-catalog-grid">
            {result.data.products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </>
      ) : (
        <div className="sb-empty-page">
          <h2>No published products matched “{query}”.</h2>
          <p>Try a product name, brand, or category.</p>
        </div>
      )}
    </StorefrontLayout>
  );
}
