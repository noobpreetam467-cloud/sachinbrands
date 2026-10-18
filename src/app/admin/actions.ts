"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";

const uuidSchema = z.string().uuid();
const slugSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160);
const productSchema = z.object({
  id: z.string().uuid(),
  category_id: z.string().uuid(),
  slug: slugSchema,
  name: z.string().trim().min(2).max(160),
  brand: z.string().trim().min(1).max(100),
  description: z.string().max(12000),
  specifications: z.record(z.string(), z.unknown()),
  price_inr: z.number().finite().positive().max(100000000),
  original_price_inr: z.number().finite().positive().max(100000000).nullable(),
  status: z.enum(["draft", "published", "archived"]),
}).refine(
  (product) => product.original_price_inr === null || product.original_price_inr >= product.price_inr,
  { path: ["original_price_inr"], message: "Original price cannot be lower than the selling price" },
);
const variantSchema = z.array(z.object({
  id: z.string().uuid().nullable().optional(),
  sku: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(160),
  attributes: z.record(z.string(), z.unknown()).default({}),
  price_inr: z.number().finite().positive().max(100000000).nullable().default(null),
  original_price_inr: z.number().finite().positive().max(100000000).nullable().default(null),
  initial_stock: z.number().int().min(0).max(1000000).default(0),
  is_active: z.boolean().default(true),
})).min(1).max(40);

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect("/login?callbackUrl=%2Fadmin");
  const { data: allowed, error } = await supabase.rpc("is_store_admin");
  if (error || allowed !== true) {
    if (error) console.error("Could not verify administrator role:", error.message);
    redirect("/admin?error=forbidden");
  }
  return { supabase, user };
}

function done(section: string, notice: string): never {
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/categories");
  redirect(`/admin?notice=${encodeURIComponent(notice)}#${section}`);
}

function fail(section: string, notice: string, error?: { message?: string } | null): never {
  if (error?.message) console.error(`Admin ${section} operation failed:`, error.message);
  redirect(`/admin?error=${encodeURIComponent(notice)}#${section}`);
}

function parseJsonObject(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function parseJsonArray(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function validProductImageUrl(url: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(supabaseUrl && url.startsWith(`${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-images/catalog/`));
}

function validCategoryImageUrl(url: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(supabaseUrl && url.startsWith(`${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-images/categories/`));
}

function validStoreImageUrl(url: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return url.startsWith("https://images.unsplash.com/") ||
    Boolean(supabaseUrl && url.startsWith(`${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/product-images/`));
}

async function isAllowedImage(file: File) {
  if (file.size > 5 * 1024 * 1024) return false;
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const has = (offset: number, signature: number[]) =>
    signature.every((byte, index) => bytes[offset + index] === byte);
  if (file.type === "image/jpeg") return has(0, [0xff, 0xd8, 0xff]);
  if (file.type === "image/png") return has(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (file.type === "image/webp") return has(0, [0x52, 0x49, 0x46, 0x46]) && has(8, [0x57, 0x45, 0x42, 0x50]);
  if (file.type === "image/avif") {
    return has(4, [0x66, 0x74, 0x79, 0x70]) &&
      ["avif", "avis"].includes(String.fromCharCode(...bytes.slice(8, 12)));
  }
  return false;
}

export async function saveProduct(formData: FormData) {
  const { supabase } = await requireAdmin();
  const idValue = formData.get("id");
  const productId = typeof idValue === "string" && uuidSchema.safeParse(idValue).success ? idValue : randomUUID();
  const specs = parseJsonObject(formData.get("specifications"));
  const variantsData = parseJsonArray(formData.get("variants"));
  const variantParsed = variantSchema.safeParse(variantsData);
  const price = Number(formData.get("priceInr"));
  const originalPriceValue = formData.get("originalPriceInr");
  const originalPrice = typeof originalPriceValue === "string" && originalPriceValue.trim() ? Number(originalPriceValue) : null;
  const product = productSchema.safeParse({
    id: productId,
    category_id: formData.get("categoryId"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    brand: formData.get("brand"),
    description: formData.get("description"),
    specifications: specs,
    price_inr: price,
    original_price_inr: originalPrice,
    status: formData.get("status"),
  });
  if (!product.success || !variantParsed.success) fail("products", "invalid-product");

  const existingImageValue = formData.get("existingImageUrls");
  const existingImageUrls = typeof existingImageValue === "string"
    ? existingImageValue.split(/\r?\n/).map((url) => url.trim()).filter(Boolean)
    : [];
  if (existingImageUrls.some((url) => !validProductImageUrl(url))) fail("products", "invalid-image-url");

  const files = formData.getAll("images").filter((value): value is File =>
    value instanceof File && value.size > 0,
  );
  if (files.length + existingImageUrls.length > 10) fail("products", "too-many-images");
  if (files.reduce((total, file) => total + file.size, 0) > 5 * 1024 * 1024) {
    fail("products", "image-upload-too-large");
  }
  if (!(await Promise.all(files.map(isAllowedImage))).every(Boolean)) fail("products", "invalid-image-file");
  const uploadedPaths: string[] = [];
  const uploadedUrls: string[] = [];
  for (const file of files) {
    const path = `catalog/${productId}/${randomUUID()}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) {
      if (uploadedPaths.length) await supabase.storage.from("product-images").remove(uploadedPaths);
      fail("products", "image-upload-failed", error);
    }
    uploadedPaths.push(path);
    uploadedUrls.push(supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl);
  }

  const imageUrls = [...existingImageUrls, ...uploadedUrls].map((url, position) => ({ url, position }));
  const { error } = await supabase.rpc("admin_save_product", {
    p_product: product.data,
    p_variants: variantParsed.data,
    p_image_urls: imageUrls,
  });
  if (error) {
    if (uploadedPaths.length) {
      const { error: cleanupError } = await supabase.storage.from("product-images").remove(uploadedPaths);
      if (cleanupError) console.error("Could not remove unreferenced uploaded product images:", cleanupError.message);
    }
    fail("products", "save-product-failed", error);
  }
  done("products", "product-saved");
}

export async function saveCategory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const idValue = formData.get("id");
  const categoryId = typeof idValue === "string" && uuidSchema.safeParse(idValue).success ? idValue : randomUUID();
  const rawImage = formData.get("imageUrl");
  let imageUrl = typeof rawImage === "string" && rawImage.trim() ? rawImage.trim() : null;
  if (imageUrl && !validCategoryImageUrl(imageUrl)) fail("categories", "invalid-category-image");
  const file = formData.get("image");
  const uploadedPath = file instanceof File && file.size > 0 ? `categories/${categoryId}/${randomUUID()}` : null;
  if (file instanceof File && file.size > 0 && !(await isAllowedImage(file))) fail("categories", "invalid-image-file");
  if (file instanceof File && file.size > 0 && uploadedPath) {
    const { error } = await supabase.storage.from("product-images").upload(uploadedPath, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });
    if (error) fail("categories", "image-upload-failed", error);
    imageUrl = supabase.storage.from("product-images").getPublicUrl(uploadedPath).data.publicUrl;
  }
  const values = {
    id: categoryId,
    slug: formData.get("slug"),
    name: formData.get("name"),
    description: formData.get("description"),
    image_url: imageUrl,
    display_order: Number(formData.get("displayOrder") ?? 0),
    is_active: formData.get("isActive") === "on",
  };
  const parsed = z.object({
    id: z.string().uuid().optional(),
    slug: slugSchema,
    name: z.string().trim().min(2).max(100),
    description: z.string().max(1000),
    image_url: z.string().url().nullable(),
    display_order: z.number().int().min(0).max(100000),
    is_active: z.boolean(),
  }).safeParse(values);
  if (!parsed.success) fail("categories", "invalid-category");
  const { id, ...category } = parsed.data;
  const { error } = id
    ? await supabase.from("categories").update(category).eq("id", id)
    : await supabase.from("categories").insert(category);
  if (error) {
    if (uploadedPath) {
      const { error: cleanupError } = await supabase.storage.from("product-images").remove([uploadedPath]);
      if (cleanupError) console.error("Could not remove unreferenced uploaded category image:", cleanupError.message);
    }
    fail("categories", "save-category-failed", error);
  }
  done("categories", "category-saved");
}

export async function saveCoupon(formData: FormData) {
  const { supabase } = await requireAdmin();
  const idValue = formData.get("id");
  const code = typeof formData.get("code") === "string" ? String(formData.get("code")).trim().toUpperCase() : "";
  const discountType = formData.get("discountType");
  const value = Number(formData.get("discountValue"));
  const minimum = Number(formData.get("minimumSubtotal") || 0);
  const maxValue = formData.get("maximumDiscount");
  const maximum = typeof maxValue === "string" && maxValue.trim() ? Number(maxValue) : null;
  const usageValue = formData.get("usageLimit");
  const usage = typeof usageValue === "string" && usageValue.trim() ? Number(usageValue) : null;
  const perUser = Number(formData.get("perUserLimit") || 1);
  const startsAtValue = formData.get("startsAt");
  const expiresAtValue = formData.get("expiresAt");
  const startsAt = typeof startsAtValue === "string" && Number.isFinite(Date.parse(startsAtValue))
    ? new Date(startsAtValue).toISOString()
    : "";
  const expiresAt = typeof expiresAtValue === "string" && expiresAtValue.trim()
    ? Number.isFinite(Date.parse(expiresAtValue)) ? new Date(expiresAtValue).toISOString() : ""
    : null;
  const parsed = z.object({
    id: z.string().uuid().optional(),
    code: z.string().regex(/^[A-Z0-9_-]{3,40}$/),
    discount_type: z.enum(["percent", "fixed"]),
    discount_value: z.number().positive().max(100000000),
    minimum_subtotal_inr: z.number().min(0),
    maximum_discount_inr: z.number().min(0).nullable(),
    usage_limit: z.number().int().positive().nullable(),
    per_user_limit: z.number().int().positive().max(10000),
    starts_at: z.string().datetime({ offset: true }),
    expires_at: z.string().datetime({ offset: true }).nullable(),
    is_active: z.boolean(),
  }).safeParse({
    id: typeof idValue === "string" && uuidSchema.safeParse(idValue).success ? idValue : undefined,
    code,
    discount_type: discountType,
    discount_value: value,
    minimum_subtotal_inr: minimum,
    maximum_discount_inr: maximum,
    usage_limit: usage,
    per_user_limit: perUser,
    starts_at: startsAt,
    expires_at: expiresAt,
    is_active: formData.get("isActive") === "on",
  });
  if (!parsed.success || (discountType === "percent" && value > 100)) fail("coupons", "invalid-coupon");
  const { id, ...coupon } = parsed.data;
  const { error } = id
    ? await supabase.from("coupons").update(coupon).eq("id", id)
    : await supabase.from("coupons").insert(coupon);
  if (error) fail("coupons", "save-coupon-failed", error);
  done("coupons", "coupon-saved");
}

export async function adjustInventory(formData: FormData) {
  const { supabase } = await requireAdmin();
  const variantId = formData.get("variantId");
  const delta = Number(formData.get("delta"));
  const note = formData.get("note");
  if (!uuidSchema.safeParse(variantId).success || !Number.isInteger(delta) || delta === 0 ||
    typeof note !== "string" || note.trim().length < 5 || note.trim().length > 500) {
    fail("inventory", "invalid-adjustment");
  }
  const { error } = await supabase.rpc("admin_adjust_inventory", {
    p_variant_id: variantId,
    p_delta: delta,
    p_note: note.trim(),
  });
  if (error) fail("inventory", "adjustment-failed", error);
  done("inventory", "inventory-updated");
}

export async function updateOrderFulfillment(formData: FormData) {
  const { supabase } = await requireAdmin();
  const orderId = formData.get("orderId");
  const status = formData.get("status");
  const carrier = formData.get("carrier");
  const trackingNumber = formData.get("trackingNumber");
  const trackingUrl = formData.get("trackingUrl");
  if (!uuidSchema.safeParse(orderId).success ||
    !["processing", "shipped", "delivered", "cancelled"].includes(String(status))) {
    fail("orders", "invalid-order-update");
  }
  if (status === "shipped" && (
    typeof carrier !== "string" || !carrier.trim() ||
    typeof trackingNumber !== "string" || !trackingNumber.trim() ||
    typeof trackingUrl !== "string" || !/^https:\/\/\S+$/i.test(trackingUrl)
  )) fail("orders", "tracking-required");
  const { error } = await supabase.rpc("admin_update_order_fulfillment", {
    p_order_id: orderId,
    p_status: status,
    p_carrier: typeof carrier === "string" ? carrier : null,
    p_tracking_number: typeof trackingNumber === "string" ? trackingNumber : null,
    p_tracking_url: typeof trackingUrl === "string" ? trackingUrl : null,
  });
  if (error) fail("orders", "order-update-failed", error);
  done("orders", "order-updated");
}

export async function updateReturnStatus(formData: FormData) {
  const { supabase } = await requireAdmin();
  const returnId = formData.get("returnId");
  const status = formData.get("status");
  if (!uuidSchema.safeParse(returnId).success ||
    !["approved", "rejected", "received", "closed"].includes(String(status))) {
    fail("returns", "invalid-return-update");
  }
  const { error } = await supabase.rpc("admin_review_return", {
    p_return_id: returnId,
    p_status: status,
  });
  if (error) fail("returns", "return-update-failed", error);
  done("returns", "return-updated");
}

export async function moderateReview(formData: FormData) {
  const { supabase } = await requireAdmin();
  const reviewId = formData.get("reviewId");
  const status = formData.get("status");
  if (!uuidSchema.safeParse(reviewId).success || !["approved", "rejected"].includes(String(status))) {
    fail("reviews", "invalid-review-update");
  }
  const { error } = await supabase.from("reviews").update({ status }).eq("id", reviewId);
  if (error) fail("reviews", "review-update-failed", error);
  done("reviews", "review-updated");
}

export async function saveStoreSettings(formData: FormData) {
  const { supabase } = await requireAdmin();
  const store = z.object({
    store_name: z.string().trim().min(2).max(100),
    cod_enabled: z.boolean(),
    razorpay_enabled: z.boolean(),
    shipping_fee_inr: z.number().min(0).max(100000000),
    free_shipping_threshold_inr: z.number().min(0).max(100000000).nullable(),
    tax_rate_percent: z.number().min(0).max(100),
    support_email: z.string().email().or(z.literal("")),
    support_phone: z.string().max(30),
    return_window_days: z.number().int().min(0).max(365),
  }).safeParse({
    store_name: formData.get("storeName"),
    cod_enabled: formData.get("codEnabled") === "on",
    razorpay_enabled: formData.get("razorpayEnabled") === "on",
    shipping_fee_inr: Number(formData.get("shippingFee")),
    free_shipping_threshold_inr: typeof formData.get("freeShippingThreshold") === "string" && String(formData.get("freeShippingThreshold")).trim()
      ? Number(formData.get("freeShippingThreshold")) : null,
    tax_rate_percent: Number(formData.get("taxRate")),
    support_email: formData.get("supportEmail") || "",
    support_phone: formData.get("supportPhone") || "",
    return_window_days: Number(formData.get("returnWindowDays")),
  });
  if (!store.success) fail("settings", "invalid-store-settings");
  if (store.data.razorpay_enabled && !(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)) {
    fail("settings", "razorpay-not-configured");
  }
  const featuredCategoryIdsValue = formData.get("featuredCategoryIds");
  const featuredProductIdsValue = formData.get("featuredProductIds");
  const featuredCategoryIds = typeof featuredCategoryIdsValue === "string"
    ? featuredCategoryIdsValue.split(/[\s,]+/).map((id) => id.trim()).filter(Boolean)
    : [];
  const featuredProductIds = typeof featuredProductIdsValue === "string"
    ? featuredProductIdsValue.split(/[\s,]+/).map((id) => id.trim()).filter(Boolean)
    : [];
  const content = z.object({
    hero_headline: z.string().trim().min(2).max(200),
    hero_description: z.string().max(1000),
    hero_cta_label: z.string().trim().min(1).max(50),
    hero_cta_url: z.string().regex(/^\/(?!\/)/).max(200),
    hero_image_url: z.string().url().nullable(),
    promotion_image_url: z.string().url().nullable(),
    support_email: z.string().email().or(z.literal("")),
    support_phone: z.string().max(30),
    return_policy: z.string().max(5000),
    shipping_policy: z.string().max(5000),
    promotion_headline: z.string().max(150),
    promotion_body: z.string().max(1000),
    promotion_cta_label: z.string().min(1).max(40),
    promotion_cta_url: z.string().regex(/^\/(?!\/)/).max(200),
    featured_category_ids: z.array(z.string().uuid()).max(20),
    featured_product_ids: z.array(z.string().uuid()).max(20),
  }).safeParse({
    hero_headline: formData.get("heroHeadline"),
    hero_description: formData.get("heroDescription"),
    hero_cta_label: formData.get("heroCtaLabel"),
    hero_cta_url: formData.get("heroCtaUrl"),
    hero_image_url: formData.get("heroImageUrl") ? formData.get("heroImageUrl") : null,
    promotion_image_url: formData.get("promotionImageUrl") ? formData.get("promotionImageUrl") : null,
    support_email: formData.get("supportEmail") || "",
    support_phone: formData.get("supportPhone") || "",
    return_policy: formData.get("returnPolicy") || "",
    shipping_policy: formData.get("shippingPolicy") || "",
    promotion_headline: formData.get("promotionHeadline") || "",
    promotion_body: formData.get("promotionBody") || "",
    promotion_cta_label: formData.get("promotionCtaLabel"),
    promotion_cta_url: formData.get("promotionCtaUrl"),
    featured_category_ids: featuredCategoryIds,
    featured_product_ids: featuredProductIds,
  });
  if (!content.success ||
    (content.data.hero_image_url !== null && !validStoreImageUrl(content.data.hero_image_url)) ||
    (content.data.promotion_image_url !== null && !validStoreImageUrl(content.data.promotion_image_url))) {
    fail("settings", "invalid-store-settings");
  }
  const { error } = await supabase.rpc("admin_save_store_settings", {
    p_settings: store.data,
    p_content: content.data,
  });
  if (error) fail("settings", "save-store-settings-failed", error);
  done("settings", "settings-saved");
}
