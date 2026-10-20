import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_HTML_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_PRODUCT_IMAGES = 3;
const MAX_REDIRECTS = 3;
const ALLOWED_HOSTS = new Set(["flipkart.com", "www.flipkart.com"]);

type ImportedImage = {
  name: string;
  type: string;
  base64: string;
};

type ProductFacts = {
  name: string;
  brand: string;
  price: number | null;
  sku: string;
  imageUrls: string[];
};

function flipkartUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !ALLOWED_HOSTS.has(url.hostname.toLowerCase()) ||
      (url.port !== "" && url.port !== "443") ||
      url.username ||
      url.password
    ) return null;
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

async function readLimitedBody(response: Response): Promise<string | null> {
  const bytes = await readLimitedBytes(response, MAX_HTML_BYTES);
  return bytes ? new TextDecoder().decode(bytes) : null;
}

async function readLimitedBytes(response: Response, maxBytes: number): Promise<Uint8Array | null> {
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function readRequestBody(request: NextRequest): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > 2048) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function productRecords(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(productRecords);
  const record = asRecord(value);
  if (!record) return [];
  const graph = Array.isArray(record["@graph"]) ? productRecords(record["@graph"]) : [];
  const type = record["@type"];
  const types = Array.isArray(type) ? type : [type];
  return [...(types.includes("Product") ? [record] : []), ...graph];
}

function imageValues(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.flatMap(imageValues);
  const record = asRecord(value);
  if (!record) return [];
  return [record.url, record.contentUrl].flatMap(imageValues);
}

function metaImageUrls(html: string, pageUrl: URL): string[] {
  const urls: string[] = [];
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attributes = new Map<string, string>();
    for (const attribute of match[0].matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attributes.set(attribute[1].toLowerCase(), attribute[2] ?? attribute[3] ?? attribute[4] ?? "");
    }
    const property = (attributes.get("property") ?? attributes.get("name") ?? "").toLowerCase();
    if (!["og:image", "og:image:secure_url", "twitter:image"].includes(property)) continue;
    const rawUrl = attributes.get("content")?.replaceAll("&amp;", "&").trim();
    if (rawUrl) {
      try {
        urls.push(new URL(rawUrl, pageUrl).toString());
      } catch {
        continue;
      }
    }
  }
  return urls;
}

function readProductFacts(html: string, pageUrl: URL): ProductFacts | null {
  const scripts = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    try {
      const parsed: unknown = JSON.parse(match[1].trim());
      for (const product of productRecords(parsed)) {
        const name = typeof product.name === "string" ? product.name.trim() : "";
        const brandValue = product.brand;
        const brandRecord = asRecord(brandValue);
        const brand = typeof brandValue === "string"
          ? brandValue.trim()
          : typeof brandRecord?.name === "string" ? brandRecord.name.trim() : "";
        const offers = Array.isArray(product.offers) ? asRecord(product.offers[0]) : asRecord(product.offers);
        const rawPrice = offers?.price ?? asRecord(offers?.priceSpecification)?.price;
        const priceValue = typeof rawPrice === "number" || typeof rawPrice === "string"
          ? Number(rawPrice)
          : Number.NaN;
        const sku = typeof product.sku === "string" ? product.sku.trim() : "";
        if (!name || name.length > 160) continue;
        const imageUrls = [
          ...imageValues(product.image),
          ...metaImageUrls(html, pageUrl),
        ].flatMap((value) => {
          try {
            return [new URL(value, pageUrl).toString()];
          } catch {
            return [];
          }
        });
        return {
          name,
          brand: brand.slice(0, 100),
          price: Number.isFinite(priceValue) && priceValue > 0 && priceValue <= 100_000_000
            ? priceValue
            : null,
          sku: sku.slice(0, 100),
          imageUrls: [...new Set(imageUrls)].slice(0, MAX_PRODUCT_IMAGES),
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

function flixkartImageUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      !/^rukminim\d+\.flixcart\.com$/i.test(url.hostname) ||
      (url.port !== "" && url.port !== "443") ||
      url.username ||
      url.password
    ) return null;
    return url;
  } catch {
    return null;
  }
}

function imageType(bytes: Uint8Array): string | null {
  const has = (offset: number, signature: number[]) =>
    signature.every((byte, index) => bytes[offset + index] === byte);
  if (has(0, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (has(0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (has(0, [0x52, 0x49, 0x46, 0x46]) && has(8, [0x57, 0x45, 0x42, 0x50])) return "image/webp";
  if (
    has(4, [0x66, 0x74, 0x79, 0x70]) &&
    ["avif", "avis"].includes(String.fromCharCode(...bytes.slice(8, 12)))
  ) return "image/avif";
  return null;
}

async function fetchProductImage(value: string, index: number): Promise<ImportedImage | null> {
  let url = flixkartImageUrl(value);
  if (!url) return null;

  let response: Response | null = null;
  for (let redirectCount = 0; redirectCount <= 2; redirectCount += 1) {
    response = await fetch(url, {
      headers: { accept: "image/avif,image/webp,image/png,image/jpeg" },
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) break;
    const location = response.headers.get("location");
    if (!location || redirectCount === 2) return null;
    const redirectedUrl = flixkartImageUrl(new URL(location, url).toString());
    if (!redirectedUrl) return null;
    url = redirectedUrl;
    await response.body?.cancel();
  }

  if (!response?.ok || !response.headers.get("content-type")?.toLowerCase().startsWith("image/")) return null;
  const bytes = await readLimitedBytes(response, MAX_IMAGE_BYTES);
  if (!bytes) return null;
  const type = imageType(bytes);
  if (!type) return null;
  const extension = type === "image/jpeg" ? "jpg" : type.slice("image/".length);
  return {
    name: `product-image-${index + 1}.${extension}`,
    type,
    base64: Buffer.from(bytes).toString("base64"),
  };
}

async function fetchProductImages(urls: string[]) {
  const images: ImportedImage[] = [];
  let failed = 0;
  for (const [index, url] of urls.entries()) {
    try {
      const image = await fetchProductImage(url, index);
      if (image) images.push(image);
      else failed += 1;
    } catch (error) {
      console.error("Could not retrieve a Flipkart product image:", error);
      failed += 1;
    }
  }
  return { images, failed };
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 2048) {
    return NextResponse.json({ error: "Request is too large." }, { status: 413 });
  }

  let supabase: Awaited<ReturnType<typeof createClient>>;
  try {
    supabase = await createClient();
  } catch (error) {
    console.error("Could not configure product link import:", error);
    return NextResponse.json({ error: "Product import is not configured." }, { status: 503 });
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") {
    console.error("Could not verify product importer session:", authError.message);
  }
  if (!user) return NextResponse.json({ error: "Sign in as a store administrator." }, { status: 401 });

  const { data: allowed, error: roleError } = await supabase.rpc("is_store_admin");
  if (roleError) {
    console.error("Could not verify product importer role:", roleError.message);
    return NextResponse.json({ error: "Administrator access could not be verified." }, { status: 503 });
  }
  if (allowed !== true) return NextResponse.json({ error: "Store administrator access is required." }, { status: 403 });

  let body: unknown;
  try {
    const bodyText = await readRequestBody(request);
    if (!bodyText) return NextResponse.json({ error: "Request is empty or too large." }, { status: 413 });
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "Enter a valid Flipkart product URL." }, { status: 400 });
  }
  const bodyRecord = asRecord(body);
  const value = bodyRecord?.url;
  const includeImages = bodyRecord?.includeImages === true;
  if (typeof value !== "string" || value.length > 2048) {
    return NextResponse.json({ error: "Enter a valid Flipkart product URL." }, { status: 400 });
  }

  let url = flipkartUrl(value.trim());
  if (!url) {
    return NextResponse.json({ error: "Only HTTPS Flipkart product links are supported." }, { status: 400 });
  }

  try {
    let response: Response | null = null;
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      response = await fetch(url, {
        headers: { accept: "text/html" },
        redirect: "manual",
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      });
      if (![301, 302, 303, 307, 308].includes(response.status)) break;
      const location = response.headers.get("location");
      if (!location || redirectCount === MAX_REDIRECTS) {
        return NextResponse.json({ error: "The product page redirected too many times." }, { status: 422 });
      }
      const redirectedUrl = flipkartUrl(new URL(location, url).toString());
      if (!redirectedUrl) {
        return NextResponse.json({ error: "The product page redirected to an unsupported address." }, { status: 422 });
      }
      url = redirectedUrl;
      response.body?.cancel();
    }

    if (!response?.ok || !response.headers.get("content-type")?.toLowerCase().includes("text/html")) {
      return NextResponse.json({ error: "Flipkart could not provide this product page." }, { status: 422 });
    }

    const html = await readLimitedBody(response);
    if (!html) return NextResponse.json({ error: "The product page is too large to process." }, { status: 413 });
    const product = readProductFacts(html, url);
    if (!product) {
      return NextResponse.json({ error: "No structured product facts were found. Enter product details manually." }, { status: 422 });
    }

    const { imageUrls, ...facts } = product;
    const images = includeImages ? await fetchProductImages(imageUrls) : { images: [], failed: 0 };
    return NextResponse.json({ product: facts, images: images.images, imageFailures: images.failed });
  } catch (error) {
    console.error("Could not retrieve Flipkart product facts:", error);
    return NextResponse.json({ error: "The product page could not be reached. Try again or enter details manually." }, { status: 502 });
  }
}
