import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogStatus, CatalogUnavailable } from "@/components/storefront/catalog-status";
import { ProductDetails } from "@/components/storefront/product-details";
import { ProductSection } from "@/components/storefront/product-section";
import { StorefrontLayout } from "@/components/storefront/storefront-layout";
import { getProductBySlug, getProductReviews, getProductVariants, getRelatedProducts } from "@/data/catalog";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getProductBySlug(slug);
  return { title: result.data?.name ?? "Product" };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getProductBySlug(slug);
  if (result.error) {
    return (
      <StorefrontLayout>
        <CatalogStatus message="Supabase product data is unavailable. Apply the catalog migration and verify public read policies." />
        <CatalogUnavailable />
      </StorefrontLayout>
    );
  }
  if (!result.data) notFound();

  const [variantResult, relatedResult, reviewsResult] = await Promise.all([
    getProductVariants(result.data.id),
    getRelatedProducts(result.data),
    getProductReviews(result.data.id),
  ]);

  return (
    <StorefrontLayout>
      {variantResult.error && (
        <CatalogStatus message="Product options could not be loaded. Check the product variants table and its public read policy." />
      )}
      {reviewsResult.error && (
        <CatalogStatus message="Customer reviews could not be loaded from Supabase." />
      )}
      <ProductDetails product={result.data} variants={variantResult.data} reviews={reviewsResult.data} />
      {relatedResult.error && (
        <CatalogStatus message="Related products could not be loaded from Supabase." />
      )}
      {relatedResult.data.length > 0 && (
        <ProductSection
          eyebrow="Keep exploring"
          title="Related products"
          products={relatedResult.data}
        />
      )}
    </StorefrontLayout>
  );
}
