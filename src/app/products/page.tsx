import type { Metadata } from "next";
import Link from "next/link";
import { CatalogStatus, CatalogUnavailable } from "@/components/storefront/catalog-status";
import { PageHeading } from "@/components/storefront/page-heading";
import { ProductCard } from "@/components/storefront/product-card";
import { StorefrontLayout } from "@/components/storefront/storefront-layout";
import { getCategories, getProductBrands, getProducts } from "@/data/catalog";

export const metadata: Metadata = { title: "All Products" };

type SearchParams = Promise<{
  q?: string;
  sort?: string;
  category?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  minRating?: string;
  inStock?: string;
  page?: string;
}>;

function parseAmount(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : undefined;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const sort = ["price-asc", "price-desc", "newest", "popular"].includes(params.sort ?? "")
    ? (params.sort as "price-asc" | "price-desc" | "newest" | "popular")
    : "newest";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const [result, categoryResult, brandsResult] = await Promise.all([
    getProducts({
      query: params.q,
      category: params.category,
      brand: params.brand,
      minPrice: parseAmount(params.minPrice),
      maxPrice: parseAmount(params.maxPrice),
      minRating: parseAmount(params.minRating),
      inStock: params.inStock === "true",
      sort,
      page,
    }),
    getCategories(),
    getProductBrands(),
  ]);
  const { products, total } = result.data;
  const pageCount = Math.max(1, Math.ceil(total / 24));
  const filters = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value && key !== "page") filters.set(key, value);
  }
  const previousFilters = new URLSearchParams(filters);
  previousFilters.set("page", String(page - 1));
  const nextFilters = new URLSearchParams(filters);
  nextFilters.set("page", String(page + 1));

  return (
    <StorefrontLayout>
      <PageHeading
        eyebrow="The considered collection"
        title="All products"
        description="Explore the products currently published in the Sachin Brands catalog."
      />
      {(result.error || categoryResult.error || brandsResult.error) && (
        <CatalogStatus message="Supabase catalog is unavailable. Apply the catalog migration and confirm public read policies to load real products." />
      )}
      {!result.error && (
        <>
          <form action="/products" className="sb-catalog-filters">
            {params.q && <input name="q" type="hidden" value={params.q} />}
            <label>
              <span>Category</span>
              <select defaultValue={params.category ?? ""} name="category">
                <option value="">All categories</option>
                {categoryResult.data.map((category) => (
                  <option key={category.id} value={category.slug}>{category.name}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Brand</span>
              <select defaultValue={params.brand ?? ""} name="brand">
                <option value="">All brands</option>
                {brandsResult.data.map((brand) => <option key={brand}>{brand}</option>)}
              </select>
            </label>
            <label><span>Min. price (₹)</span><input min="0" name="minPrice" type="number" defaultValue={params.minPrice ?? ""} /></label>
            <label><span>Max. price (₹)</span><input min="0" name="maxPrice" type="number" defaultValue={params.maxPrice ?? ""} /></label>
            <label>
              <span>Rating</span>
              <select defaultValue={params.minRating ?? ""} name="minRating">
                <option value="">Any rating</option>
                {[4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}+ stars</option>)}
              </select>
            </label>
            <label>
              <span>Sort by</span>
              <select defaultValue={sort} name="sort">
                <option value="newest">Newest</option>
                <option value="popular">Popularity</option>
                <option value="price-asc">Price: low to high</option>
                <option value="price-desc">Price: high to low</option>
              </select>
            </label>
            <label className="sb-filter-checkbox">
              <input defaultChecked={params.inStock === "true"} name="inStock" type="checkbox" value="true" />
              <span>In stock</span>
            </label>
            <button className="sb-button sb-button-primary" type="submit">Apply filters</button>
            <Link className="sb-text-link" href="/products">Clear</Link>
          </form>
          <div className="sb-catalog-toolbar"><span>{total} products</span></div>
          {products.length ? (
            <>
              <div className="sb-product-grid sb-catalog-grid">
                {products.map((product) => <ProductCard key={product.id} product={product} />)}
              </div>
              {pageCount > 1 && (
                <nav aria-label="Product pages" className="sb-pagination">
                  {page > 1 && (
                    <Link href={`/products?${previousFilters}`}>Previous</Link>
                  )}
                  <span>Page {page} of {pageCount}</span>
                  {page < pageCount && (
                    <Link href={`/products?${nextFilters}`}>Next</Link>
                  )}
                </nav>
              )}
            </>
          ) : (
            <div className="sb-empty-page">
              <h2>{total === 0 && !params.q && !params.category && !params.brand && !params.minPrice && !params.maxPrice && !params.minRating && params.inStock !== "true" ? "No published products yet." : "No products match these filters."}</h2>
              <p>Try changing or clearing your filters. Only published Supabase products are shown.</p>
            </div>
          )}
        </>
      )}
      {result.error && <CatalogUnavailable />}
    </StorefrontLayout>
  );
}
