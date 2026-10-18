import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogStatus, CatalogUnavailable } from "@/components/storefront/catalog-status";
import { PageHeading } from "@/components/storefront/page-heading";
import { ProductCard } from "@/components/storefront/product-card";
import { StorefrontLayout } from "@/components/storefront/storefront-layout";
import { getCategories, getProducts } from "@/data/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const categories = await getCategories();
  const category = categories.data.find((item) => item.slug === slug);
  return { title: category?.name ?? "Category" };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [categories, result] = await Promise.all([
    getCategories(),
    getProducts({ category: slug, pageSize: 48 }),
  ]);
  if (!categories.error && !categories.data.some((item) => item.slug === slug)) notFound();
  const category = categories.data.find((item) => item.slug === slug);

  return (
    <StorefrontLayout active="categories">
      <PageHeading
        eyebrow="Shop by category"
        title={category?.name ?? "Category"}
        description={category?.description ?? "Browse published products in this category."}
      />
      {(categories.error || result.error) && (
        <CatalogStatus message="Supabase category data is unavailable. Apply the catalog migration and verify public read policies." />
      )}
      {result.error ? <CatalogUnavailable /> : result.data.products.length ? (
        <>
          <p className="sb-catalog-toolbar"><span>{result.data.total} products</span></p>
          <div className="sb-product-grid sb-catalog-grid">
            {result.data.products.map((product) => <ProductCard key={product.id} product={product} />)}
          </div>
        </>
      ) : (
        <div className="sb-empty-page">
          <h2>No products in this category yet.</h2>
          <p>Published products will appear here when they are added to Supabase.</p>
        </div>
      )}
    </StorefrontLayout>
  );
}
