import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { createReadOnlyClient } from "@/utils/supabase/server";
import {
  CATALOG_PRODUCT_SELECT,
  mapCatalogProduct,
  normalizeCatalogSearchTerm,
  numeric,
  stringRecord,
  type CatalogProductRow,
  type StoreCategory,
  type StoreImage,
  type StoreProduct,
  type StoreReview,
  type StoreVariant,
} from "./catalog-types";

type CatalogCategoryRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  image_url: string | null;
};

export type CatalogError = {
  message: string;
  code?: string;
};

export type CatalogResult<T> = {
  data: T;
  error: CatalogError | null;
};

export type ProductFilters = {
  query?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  sort?: "price-asc" | "price-desc" | "newest" | "popular";
  page?: number;
  pageSize?: number;
  ids?: string[];
};

type CatalogClientResult =
  | { client: Awaited<ReturnType<typeof createReadOnlyClient>>; error: null }
  | { client: null; error: CatalogError };

async function getCatalogClient(): Promise<CatalogClientResult> {
  try {
    return { client: await createReadOnlyClient(), error: null };
  } catch (error) {
    unstable_rethrow(error);
    console.error("Could not configure Supabase catalog client:", error);
    return {
      client: null,
      error: {
        message: error instanceof Error ? error.message : "Supabase catalog configuration is unavailable.",
        code: "SUPABASE_CONFIGURATION_ERROR",
      },
    };
  }
}

export async function getCategories(): Promise<CatalogResult<StoreCategory[]>> {
  const clientResult = await getCatalogClient();
  if (clientResult.error) return { data: [], error: clientResult.error };
  const supabase = clientResult.client;
  const { data, error } = await supabase
    .from("categories")
    .select("id,slug,name,description,image_url")
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("Supabase catalog categories query failed:", error);
    return { data: [], error: { message: error.message, code: error.code } };
  }

  return {
    data: ((data ?? []) as CatalogCategoryRow[]).map((category) => ({
      id: category.id,
      slug: category.slug,
      name: category.name,
      description: category.description ?? "",
      image: category.image_url,
    })),
    error: null,
  };
}

export async function getProducts(
  filters: ProductFilters = {},
): Promise<CatalogResult<{ products: StoreProduct[]; total: number }>> {
  const clientResult = await getCatalogClient();
  if (clientResult.error) {
    return { data: { products: [], total: 0 }, error: clientResult.error };
  }
  const supabase = clientResult.client;
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(48, Math.max(1, filters.pageSize ?? 24));
  let query = supabase
    .from("catalog_products")
    .select(CATALOG_PRODUCT_SELECT, { count: "exact" });

  if (filters.ids?.length) query = query.in("id", filters.ids);
  if (filters.query?.trim()) {
    const term = normalizeCatalogSearchTerm(filters.query);
    if (!term) return { data: { products: [], total: 0 }, error: null };
    const categoryResult = await supabase
      .from("categories")
      .select("id")
      .eq("is_active", true)
      .ilike("name", `%${term}%`);
    if (categoryResult.error) {
      console.error("Supabase catalog search category query failed:", categoryResult.error);
      return {
        data: { products: [], total: 0 },
        error: { message: categoryResult.error.message, code: categoryResult.error.code },
      };
    }
    const categoryIds = (categoryResult.data ?? []).map((category) => category.id);
    const searchFilters = [`name.ilike.%${term}%`, `brand.ilike.%${term}%`];
    if (categoryIds.length) {
      searchFilters.push(`category_id.in.(${categoryIds.join(",")})`);
    }
    query = query.or(searchFilters.join(","));
  }

  if (filters.category) query = query.eq("category_slug", filters.category);
  if (filters.brand) query = query.eq("brand", filters.brand);
  if (filters.minPrice !== undefined) query = query.gte("variant_price_inr", filters.minPrice);
  if (filters.maxPrice !== undefined) query = query.lte("variant_price_inr", filters.maxPrice);
  if (filters.minRating !== undefined) query = query.gte("rating", filters.minRating);
  if (filters.inStock) query = query.gt("stock_quantity", 0);

  switch (filters.sort) {
    case "price-asc":
      query = query.order("variant_price_inr", { ascending: true });
      break;
    case "price-desc":
      query = query.order("variant_price_inr", { ascending: false });
      break;
    case "popular":
      query = query.order("popularity_score", { ascending: false });
      break;
    default:
      query = query.order("created_at", { ascending: false });
  }

  const { data, error, count } = await query.range(
    (page - 1) * pageSize,
    page * pageSize - 1,
  );
  if (error) {
    console.error("Supabase catalog products query failed:", error);
    return { data: { products: [], total: 0 }, error: { message: error.message, code: error.code } };
  }
  return {
    data: {
      products: ((data ?? []) as CatalogProductRow[]).map(mapCatalogProduct),
      total: count ?? 0,
    },
    error: null,
  };
}

export async function getProductBrands(): Promise<CatalogResult<string[]>> {
  const clientResult = await getCatalogClient();
  if (clientResult.error) return { data: [], error: clientResult.error };
  const supabase = clientResult.client;
  const { data, error } = await supabase
    .from("catalog_products")
    .select("brand")
    .order("brand")
    .limit(1000);

  if (error) {
    console.error("Supabase catalog brands query failed:", error);
    return { data: [], error: { message: error.message, code: error.code } };
  }
  return {
    data: Array.from(new Set((data ?? []).map((row) => row.brand))),
    error: null,
  };
}

export const getProductBySlug = cache(async (
  slug: string,
): Promise<CatalogResult<StoreProduct | null>> => {
  const clientResult = await getCatalogClient();
  if (clientResult.error) return { data: null, error: clientResult.error };
  const supabase = clientResult.client;
  const { data, error } = await supabase
    .from("catalog_products")
    .select(CATALOG_PRODUCT_SELECT)
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("Supabase catalog product query failed:", error);
    return { data: null, error: { message: error.message, code: error.code } };
  }
  if (!data) return { data: null, error: null };

  const productRow = data as CatalogProductRow;
  const imageResult = await supabase
    .from("product_images")
    .select("image_url,alt_text")
    .eq("product_id", productRow.product_id)
    .order("position");

  if (imageResult.error) {
    const error = imageResult.error;
    console.error("Supabase product detail data query failed:", error);
    return { data: null, error: { message: error.message, code: error.code } };
  }

  const images: StoreImage[] = (imageResult.data ?? []).map((image) => ({
    url: image.image_url,
    alt: image.alt_text ?? productRow.name,
  }));
  const product = mapCatalogProduct(productRow);
  product.images = images;
  return { data: product, error: null };
});

export async function getProductVariants(
  productId: string,
): Promise<CatalogResult<StoreVariant[]>> {
  const clientResult = await getCatalogClient();
  if (clientResult.error) return { data: [], error: clientResult.error };
  const supabase = clientResult.client;
  const { data, error } = await supabase
    .from("product_variants")
    .select("id,sku,name,attributes,price_inr,original_price_inr,stock_quantity")
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("name");

  if (error) {
    console.error("Supabase product variants query failed:", error);
    return { data: [], error: { message: error.message, code: error.code } };
  }

  return {
    data: (data ?? []).map((variant) => ({
      id: variant.id,
      sku: variant.sku,
      name: variant.name,
      attributes: stringRecord(variant.attributes),
      price: variant.price_inr === null ? null : numeric(variant.price_inr),
      originalPrice:
        variant.original_price_inr === null ? null : numeric(variant.original_price_inr),
      stockQuantity: variant.stock_quantity,
    })),
    error: null,
  };
}

export async function getProductReviews(
  productId: string,
): Promise<CatalogResult<StoreReview[]>> {
  const clientResult = await getCatalogClient();
  if (clientResult.error) return { data: [], error: clientResult.error };
  const supabase = clientResult.client;
  const { data, error } = await supabase
    .from("reviews")
    .select("id,rating,title,body,created_at")
    .eq("product_id", productId)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Supabase product reviews query failed:", error);
    return { data: [], error: { message: error.message, code: error.code } };
  }
  return {
    data: (data ?? []).map((review) => ({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      createdAt: review.created_at,
    })),
    error: null,
  };
}

export async function getRelatedProducts(
  product: StoreProduct,
): Promise<CatalogResult<StoreProduct[]>> {
  const result = await getProducts({ category: product.categorySlug, pageSize: 5 });
  return {
    data: result.data.products.filter((item) => item.id !== product.id).slice(0, 4),
    error: result.error,
  };
}
