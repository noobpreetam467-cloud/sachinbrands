export type StoreCategory = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image: string | null;
};

export type StoreVariant = {
  id: string;
  sku: string;
  name: string;
  attributes: Record<string, string>;
  price: number | null;
  originalPrice: number | null;
  stockQuantity: number;
};

export type StoreImage = {
  url: string;
  alt: string;
};

export type StoreReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  createdAt: string;
};

export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  brand: string;
  category: string;
  categorySlug: string;
  description: string;
  specifications: Record<string, string>;
  price: number;
  originalPrice: number | null;
  rating: number | null;
  reviewCount: number;
  stockQuantity: number;
  defaultVariantStockQuantity: number;
  sku: string | null;
  defaultVariantId: string | null;
  badge: string | null;
  images: StoreImage[];
};

export type CatalogProductRow = {
  id: string;
  product_id: string;
  slug: string;
  name: string;
  brand: string;
  description: string;
  specifications: Record<string, unknown> | null;
  price_inr: string | number;
  original_price_inr: string | number | null;
  variant_price_inr: string | number;
  variant_original_price_inr: string | number | null;
  category_id: string;
  category_name: string;
  category_slug: string;
  primary_image_url: string | null;
  primary_image_alt: string | null;
  rating: string | number | null;
  review_count: number;
  stock_quantity: number;
  available_variant_stock_quantity: number;
  available_variant_id: string | null;
  sku: string | null;
  badge: string | null;
};

export const CATALOG_PRODUCT_SELECT =
  "id,product_id,slug,name,brand,description,specifications,price_inr,original_price_inr,variant_price_inr,variant_original_price_inr,category_id,category_name,category_slug,primary_image_url,primary_image_alt,rating,review_count,stock_quantity,available_variant_stock_quantity,available_variant_id,sku,badge";

export function numeric(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function normalizeCatalogSearchTerm(value: string): string {
  return value
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ");
}

export function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => typeof entry === "string" || typeof entry === "number")
      .map(([key, entry]) => [key, String(entry)]),
  );
}

export function mapCatalogProduct(row: CatalogProductRow): StoreProduct {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    brand: row.brand,
    category: row.category_name,
    categorySlug: row.category_slug,
    description: row.description,
    specifications: stringRecord(row.specifications),
    price: numeric(row.variant_price_inr),
    originalPrice:
      row.variant_original_price_inr === null
        ? null
        : numeric(row.variant_original_price_inr),
    rating: row.rating === null ? null : numeric(row.rating),
    reviewCount: row.review_count,
    stockQuantity: row.stock_quantity,
    defaultVariantStockQuantity: row.available_variant_stock_quantity,
    sku: row.sku,
    defaultVariantId: row.available_variant_id,
    badge: row.badge,
    images: row.primary_image_url
      ? [{ url: row.primary_image_url, alt: row.primary_image_alt ?? row.name }]
      : [],
  };
}

export function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(price);
}
