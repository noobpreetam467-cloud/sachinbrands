"use client";

import { useState, type FormEvent } from "react";

type ImportedProduct = {
  name: string;
  brand: string;
  price: number | null;
};

type ImportedImage = {
  name: string;
  type: string;
  base64: string;
};

const MAX_IMAGE_BYTES = 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);

function parseImportedProduct(value: unknown): ImportedProduct | null {
  if (!value || typeof value !== "object") return null;
  if (
    !("name" in value) ||
    !("brand" in value) ||
    !("price" in value) ||
    typeof value.name !== "string" ||
    typeof value.brand !== "string" ||
    (value.price !== null && typeof value.price !== "number")
  ) return null;
  return { name: value.name, brand: value.brand, price: value.price };
}

function parseImportedImages(value: unknown): ImportedImage[] | null {
  if (!Array.isArray(value)) return null;
  const images: ImportedImage[] = [];
  for (const image of value) {
    if (
      !image ||
      typeof image !== "object" ||
      !("name" in image) ||
      !("type" in image) ||
      !("base64" in image) ||
      typeof image.name !== "string" ||
      typeof image.type !== "string" ||
      typeof image.base64 !== "string" ||
      !ALLOWED_IMAGE_TYPES.has(image.type) ||
      image.base64.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(image.base64)
    ) return null;
    images.push({ name: image.name, type: image.type, base64: image.base64 });
  }
  return images;
}

function addImportedImages(images: ImportedImage[]): string | null {
  if (images.length === 0) return null;
  const input = document.getElementById("create-product-images");
  if (!(input instanceof HTMLInputElement) || !input.multiple) {
    return "Product facts were added, but the product image upload field is unavailable. Upload the images manually.";
  }

  try {
    const files = Array.from(input.files ?? []);
    for (const image of images) {
      const decoded = atob(image.base64);
      const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
      if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
        return "Product facts were added, but an imported image exceeded the per-image size limit.";
      }
      files.push(new File([bytes], image.name, { type: image.type }));
    }

    const totalBytes = files.reduce((total, file) => total + file.size, 0);
    if (files.length > 10 || totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      return "Product facts were added, but there is not enough room for the imported photos. Remove some selected images or upload photos manually.";
    }

    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return null;
  } catch (caught) {
    console.error("Could not add imported product photos to the upload form:", caught);
    return "Product facts were added, but the browser could not attach the photos. Upload them manually.";
  }
}

function setFormValue(form: HTMLFormElement, name: string, value: string) {
  const field = form.elements.namedItem(name);
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return;
  const prototype = field instanceof HTMLInputElement ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  setter?.call(field, value);
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function slugify(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 150);
}

export function ProductLinkAssistant() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [includeImages, setIncludeImages] = useState(false);

  async function importFacts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError(false);

    try {
      const response = await fetch("/api/admin/product-import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, includeImages }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const explanation = result && typeof result === "object" && "error" in result &&
          typeof result.error === "string" ? result.error : "Product details could not be imported.";
        throw new Error(explanation);
      }

      const product = result && typeof result === "object" && "product" in result
        ? parseImportedProduct(result.product)
        : null;
      if (!product) throw new Error("Product details could not be imported.");
      const responseRecord = result && typeof result === "object" ? result : null;
      const images = parseImportedImages(responseRecord && "images" in responseRecord ? responseRecord.images : null);
      if (!images) throw new Error("The imported product photos could not be read.");
      const imageFailures = responseRecord && "imageFailures" in responseRecord &&
        typeof responseRecord.imageFailures === "number" ? responseRecord.imageFailures : 0;

      const form = document.getElementById("create-product-form");
      if (!(form instanceof HTMLFormElement)) throw new Error("The product form is unavailable. Reload the page and try again.");

      setFormValue(form, "name", product.name);
      if (product.brand) setFormValue(form, "brand", product.brand);
      if (product.price !== null) setFormValue(form, "priceInr", String(product.price));

      const slugField = form.elements.namedItem("slug");
      const currentSlug = slugField instanceof HTMLInputElement ? slugField.value : "";
      const slug = slugify(`${product.brand} ${product.name}`) || `product-${crypto.randomUUID().slice(0, 8).toLowerCase()}`;
      if (!currentSlug) setFormValue(form, "slug", slug);

      const price = product.price;
      const sku = `SB-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
      setFormValue(form, "variants", JSON.stringify([{
        id: null,
        sku,
        name: "Standard",
        attributes: {},
        price_inr: price,
        original_price_inr: null,
        initial_stock: 0,
        is_active: true,
      }], null, 2));

      const imageWarning = images.length ? addImportedImages(images) : null;
      const photoStatus = !includeImages
        ? "Photos were not requested."
        : images.length
          ? `Added ${images.length} photo(s) to the upload field.${imageFailures ? ` ${imageFailures} photo(s) could not be downloaded.` : ""}`
          : `No usable product photos were found${imageFailures ? ` (${imageFailures} image link(s) were unavailable)` : ""}.`;
      setMessage([
        "Product facts added. Review them, select a category, add a description you have rights to use, and verify the price.",
        photoStatus,
        imageWarning,
        "The generated SKU is a placeholder; stock starts at zero.",
      ].filter(Boolean).join(" "));
    } catch (caught) {
      setError(true);
      setMessage(caught instanceof Error ? caught.message : "Product details could not be imported.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-link-assistant" onSubmit={importFacts}>
      <div className="admin-link-assistant-copy">
        <strong>Product link assistant</strong>
        <p>Prefill product facts and, if authorized, add product photos to the existing upload field. Review everything before saving.</p>
      </div>
      <label htmlFor="product-source-url">Flipkart product URL</label>
      <div className="admin-link-assistant-controls">
        <input
          autoComplete="url"
          id="product-source-url"
          maxLength={2048}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://www.flipkart.com/..."
          required
          type="url"
          value={url}
        />
        <button className="admin-button admin-button-primary" disabled={busy} type="submit">
          {busy ? "Reading link…" : "Get product facts"}
        </button>
      </div>
      <label className="admin-link-assistant-permission">
        <input
          checked={includeImages}
          onChange={(event) => setIncludeImages(event.target.checked)}
          type="checkbox"
        />
        I have permission to use the product photos on my store
      </label>
      <p className="admin-link-assistant-note">When selected, up to three photos are added as editable uploads. Photos are saved to your store only when you submit the product form.</p>
      {message && <p className={`admin-link-assistant-message${error ? " is-error" : ""}`} role={error ? "alert" : "status"}>{message}</p>}
    </form>
  );
}
