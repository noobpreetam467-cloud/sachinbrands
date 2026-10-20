import type { Metadata } from "next";
import Link from "next/link";
import { CatalogStatus } from "@/components/storefront/catalog-status";
import { Icon } from "@/components/storefront/icon";
import { PageHeading } from "@/components/storefront/page-heading";
import { StorefrontLayout } from "@/components/storefront/storefront-layout";
import { getCategories } from "@/data/catalog";
import { CatalogImage } from "@/components/storefront/catalog-image";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const result = await getCategories();
  return (
    <StorefrontLayout active="categories">
      <PageHeading
        eyebrow="A place to begin"
        title="Explore by category"
        description="Browse active product categories from the Sachin Brands catalog."
      />
      {result.error && (
        <CatalogStatus
          message={result.error.code === "SUPABASE_CONFIGURATION_ERROR"
            ? "Supabase is not configured for this deployment. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY to the Vercel project, then redeploy."
            : "Supabase categories could not be loaded. Apply the catalog migration and check public read access."}
        />
      )}
      {result.data.length ? (
        <div className="sb-category-grid sb-category-page-grid">
          {result.data.map((category) => (
            <Link className="sb-category-card" href={`/categories/${category.slug}`} key={category.id}>
              <div className="sb-category-image">
                {category.image ? (
                <CatalogImage alt="" sizes="(max-width: 640px) 90vw, 30vw" src={category.image} />
                ) : <span className="sb-product-image-placeholder" />}
              </div>
              <div className="sb-category-overlay">
                <span>{category.name}</span>
                <span>{category.description}</span>
                <Icon name="arrow" size={18} />
              </div>
            </Link>
          ))}
        </div>
      ) : !result.error ? (
        <div className="sb-empty-page"><h2>No active categories yet.</h2><p>Active categories will appear here once they are configured in Supabase.</p></div>
      ) : null}
    </StorefrontLayout>
  );
}
