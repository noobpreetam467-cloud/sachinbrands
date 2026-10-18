import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_LOGO_PATH, SITE_NAME } from "@/config/site";
import {
  adjustInventory,
  moderateReview,
  saveCategory,
  saveCoupon,
  saveProduct,
  saveStoreSettings,
  updateOrderFulfillment,
  updateReturnStatus,
} from "./actions";
import { ConfirmAdminSubmit } from "./confirm-admin-submit";

type AdminRow = Record<string, unknown>;
type DashboardProps = {
  categories: AdminRow[];
  coupons: AdminRow[];
  customers: AdminRow[];
  customerOrders: AdminRow[];
  customerId: string;
  customerPage: number;
  customerTotal: number;
  days: number;
  errorCode: string | null;
  errorMessage: string | null;
  inventory: AdminRow[];
  metrics: AdminRow;
  notice: string | null;
  orderPage: number;
  orderSearch: string;
  orderStatus: string;
  orders: AdminRow[];
  orderTotal: number;
  productPage: number;
  productTotal: number;
  products: AdminRow[];
  razorpayConfigured: boolean;
  returns: AdminRow[];
  reviews: AdminRow[];
  settings: AdminRow;
  storefront: AdminRow;
  userEmail: string;
};

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function num(value: unknown): number {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function row(value: unknown): AdminRow {
  return value && typeof value === "object" && !Array.isArray(value) ? value as AdminRow : {};
}

function list(value: unknown): AdminRow[] {
  return Array.isArray(value) ? value.map(row) : [];
}

function related(value: unknown): AdminRow {
  return row(Array.isArray(value) ? value[0] : value);
}

function inr(value: unknown): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(num(value));
}

function date(value: unknown): string {
  const timestamp = Date.parse(text(value));
  return Number.isFinite(timestamp) ? new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp) : "—";
}

function dateInput(value: unknown): string {
  const timestamp = Date.parse(text(value));
  if (!Number.isFinite(timestamp)) return "";
  const d = new Date(timestamp);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function humanize(value: unknown): string {
  return text(value, "unknown").replaceAll("_", " ");
}

function messageFor(code: string | null, kind: "notice" | "error"): string | null {
  if (!code) return null;
  const known: Record<string, string> = {
    "product-saved": "Product changes saved.",
    "category-saved": "Category changes saved.",
    "coupon-saved": "Coupon changes saved.",
    "inventory-updated": "Inventory adjustment recorded.",
    "order-updated": "Order status updated.",
    "return-updated": "Return request updated. Any refund still requires verified payment-provider processing.",
    "review-updated": "Review moderation saved.",
    "settings-saved": "Store settings and homepage content saved.",
    "invalid-product": "Product details or variants are invalid.",
    "invalid-image-url": "Use only image URLs from this project's public product-images catalog folder.",
    "invalid-category-image": "Use an image from this project's public product-images categories folder.",
    "too-many-images": "Products can have at most 10 images.",
    "invalid-image-file": "Choose JPEG, PNG, WebP or AVIF images up to 5 MB each.",
    "image-upload-too-large": "The combined upload size for a product save is limited to 5 MB.",
    "image-upload-failed": "Image upload failed. Check the product-images bucket and administrator upload policy.",
    "save-product-failed": "Could not save the product. Check required fields, SKUs and database policy.",
    "invalid-category": "Category details are invalid.",
    "save-category-failed": "Could not save the category. Check its slug and database policy.",
    "invalid-coupon": "Coupon details or date range are invalid.",
    "save-coupon-failed": "Could not save this coupon. Check the code and date range.",
    "invalid-adjustment": "Enter a non-zero stock change and a reason of at least five characters.",
    "adjustment-failed": "Stock adjustment was rejected. Confirm stock will not become negative.",
    "invalid-order-update": "Choose a permitted order status transition.",
    "tracking-required": "Carrier, tracking number and a valid HTTPS tracking URL are required before shipping.",
    "order-update-failed": "This order transition is not permitted, or payment confirmation is still pending.",
    "invalid-return-update": "Choose a valid return request status.",
    "return-update-failed": "Could not update this return request. Check its current status.",
    "invalid-review-update": "Choose approved or rejected for review moderation.",
    "review-update-failed": "Could not moderate this review.",
    "invalid-store-settings": "One or more store settings are invalid.",
    "save-store-settings-failed": "Could not save store settings; check that featured IDs refer to active catalog items.",
    "razorpay-not-configured": "Razorpay cannot be enabled until server-only RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are configured.",
  };
  return known[code] ?? (kind === "error" ? "The operation could not be completed." : null);
}

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <div className="admin-page-heading admin-section-heading" id={id}>
      <div>
        <div className="admin-eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
    </div>
  );
}

function Panel({ title, description, children, id }: {
  title: string;
  description?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="admin-panel admin-management-panel" id={id}>
      <div className="admin-panel-heading">
        <div><h3>{title}</h3>{description && <p>{description}</p>}</div>
      </div>
      {children}
    </section>
  );
}

function Pager({ page, pages, href }: { page: number; pages: number; href: (page: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Page navigation" className="admin-pager">
      <Link aria-disabled={page <= 1} className="admin-button admin-button-light" href={href(Math.max(1, page - 1))}>Previous</Link>
      <span>Page {page} of {pages}</span>
      <Link aria-disabled={page >= pages} className="admin-button admin-button-light" href={href(Math.min(pages, page + 1))}>Next</Link>
    </nav>
  );
}

function ProductForm({ product, categories }: { product?: AdminRow; categories: AdminRow[] }) {
  const variants = product ? list(product.product_variants) : [];
  const images = product ? list(product.product_images) : [];
  const specifications = product ? row(product.specifications) : {};
  return (
    <form action={saveProduct} className="admin-form admin-product-form">
      {product && <input name="id" type="hidden" value={text(product.id)} />}
      <label>Product name<input defaultValue={text(product?.name)} maxLength={160} name="name" required /></label>
      <label>Slug<input defaultValue={text(product?.slug)} name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></label>
      <label>Brand<input defaultValue={text(product?.brand)} maxLength={100} name="brand" required /></label>
      <label>Category<select defaultValue={text(product?.category_id)} name="categoryId" required>
        <option value="">Select category</option>
        {categories.filter((category) => category.is_active === true).map((category) => (
          <option key={text(category.id)} value={text(category.id)}>{text(category.name)}</option>
        ))}
      </select></label>
      <label>Selling price (INR)<input defaultValue={text(product?.price_inr)} min="0.01" name="priceInr" required step="0.01" type="number" /></label>
      <label>Original price (INR)<input defaultValue={text(product?.original_price_inr)} min="0.01" name="originalPriceInr" step="0.01" type="number" /></label>
      <label>Status<select defaultValue={text(product?.status, "draft")} name="status">
        <option value="draft">Draft</option><option value="published">Published</option><option value="archived">Archived</option>
      </select></label>
      <label className="admin-field-wide">Description<textarea defaultValue={text(product?.description)} maxLength={12000} name="description" rows={4} /></label>
      <label className="admin-field-wide">Specifications (JSON object)
        <textarea defaultValue={JSON.stringify(specifications, null, 2)} name="specifications" placeholder='{"display":"6.1 inch","connectivity":"5G"}' required rows={4} />
      </label>
      <label className="admin-field-wide">Variants (JSON array)
        <textarea defaultValue={JSON.stringify(variants.length ? variants.map((variant) => ({
          id: variant.id ?? null,
          sku: variant.sku,
          name: variant.name,
          attributes: variant.attributes ?? {},
          price_inr: variant.price_inr ?? null,
          original_price_inr: variant.original_price_inr ?? null,
          initial_stock: variant.stock_quantity ?? 0,
          is_active: variant.is_active ?? true,
        })) : [{ id: null, sku: "", name: "Standard", attributes: {}, price_inr: null, original_price_inr: null, initial_stock: 0, is_active: true }], null, 2)} name="variants" required rows={8} />
        <small>Existing variant stock is read-only here. Adjust it in Inventory so each change has an audit record.</small>
      </label>
      <label className="admin-field-wide">Existing image URLs, one per line
        <textarea defaultValue={images.sort((a, b) => num(a.position) - num(b.position)).map((image) => text(image.image_url)).join("\n")} name="existingImageUrls" rows={3} />
      </label>
      <label className="admin-field-wide">Upload additional product images
        <input accept="image/jpeg,image/png,image/webp,image/avif" multiple name="images" type="file" />
        <small>JPEG, PNG, WebP or AVIF; 5 MB combined per save and 10 images total.</small>
      </label>
      <ConfirmAdminSubmit className="admin-button admin-button-primary" confirmField="status" confirmValue="archived" message="Archive this product from the customer storefront? Existing order history will remain." >{product ? "Save product" : "Create product"}</ConfirmAdminSubmit>
    </form>
  );
}

export default function AdminDashboard(props: DashboardProps) {
  const metrics = props.metrics;
  const series = list(metrics.sales_series);
  const maxSales = Math.max(1, ...series.map((point) => num(point.revenue_inr)));
  const orders = props.orders;
  const orderPageCount = Math.max(1, Math.ceil(props.orderTotal / 20));
  const productPageCount = Math.max(1, Math.ceil(props.productTotal / 25));
  const customerPageCount = Math.max(1, Math.ceil(props.customerTotal / 50));
  const featuredBestSellers = list(metrics.best_sellers);
  const lowStock = list(metrics.low_stock_items);
  const notice = messageFor(props.notice, "notice");
  const error = messageFor(props.errorCode, "error");
  const sections = [
    ["Overview", "#overview"],
    ["Products", "#products"],
    ["Categories", "#categories"],
    ["Orders", "#orders"],
    ["Customers", "#customers"],
    ["Inventory", "#inventory"],
    ["Coupons", "#coupons"],
    ["Returns", "#returns"],
    ["Reviews", "#reviews"],
    ["Store settings", "#settings"],
  ] as const;
  const orderQuery = new URLSearchParams();
  if (props.orderSearch) orderQuery.set("orderSearch", props.orderSearch);
  if (props.orderStatus) orderQuery.set("orderStatus", props.orderStatus);
  const orderHref = (page: number) => `/admin?${new URLSearchParams({ ...Object.fromEntries(orderQuery), ordersPage: String(page) }).toString()}#orders`;
  const customerHref = (page: number) => `/admin?customersPage=${page}#customers`;
  const productHref = (page: number) => `/admin?productsPage=${page}#products`;
  const featuredIds = (value: unknown) => Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join(", ")
    : "";

  return (
    <div className="admin-shell" id="overview">
      <aside className="admin-sidebar">
        <Link aria-label={`${SITE_NAME} storefront`} className="admin-brand" href="/">
          <Image alt="" height={34} priority src={SITE_LOGO_PATH} width={34} />
          <span>{SITE_NAME}</span>
        </Link>
        <div className="admin-store-label">STORE MANAGEMENT</div>
        <nav aria-label="Admin navigation" className="admin-navigation">
          {sections.map(([label, href], index) => (
            <a aria-current={index === 0 ? "page" : undefined} className={`admin-nav-link${index === 0 ? " is-active" : ""}`} href={href} key={label}>
              <span aria-hidden="true" className="admin-nav-symbol">{["◫", "◇", "▦", "▤", "♙", "◈", "%", "↩", "☆", "⚙"][index]}</span>
              <span>{label}</span>
              {label === "Orders" && props.orderTotal > 0 && <span className="admin-nav-count">{props.orderTotal}</span>}
            </a>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <div className="admin-profile">
            <span className="admin-avatar">{props.userEmail.slice(0, 1).toUpperCase()}</span>
            <span className="admin-profile-copy"><strong>Store administrator</strong><span>{props.userEmail}</span></span>
          </div>
          <Link className="admin-back-link" href="/">← Back to store</Link>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb"><span>Store</span><span>/</span><strong>Administration</strong></div>
          <span className="admin-topbar-user">{props.userEmail}</span>
          <Link className="admin-store-link" href="/">View storefront ↗</Link>
        </header>

        <div className="admin-content">
          <div className="admin-page-heading">
            <div><div className="admin-eyebrow">STORE OVERVIEW</div><h1>Good to see you<span>.</span></h1><p>Live performance and store operations from your Supabase project.</p></div>
            <Link className="admin-button admin-button-light" href="/products">View catalog ↗</Link>
          </div>
          {props.errorMessage && <div className="admin-alert is-error" role="alert">{props.errorMessage}</div>}
          {notice && <div className="admin-alert is-success" role="status">{notice}</div>}
          {error && <div className="admin-alert is-error" role="alert">{error}</div>}

          <div className="admin-metrics">
            {[
              ["Orders", text(metrics.orders_total), "All recorded orders"],
              ["Eligible revenue", inr(metrics.revenue_inr), "Paid orders only; refunds excluded"],
              ["Pending orders", text(metrics.pending_orders), "Awaiting payment or fulfillment"],
              ["Customers", text(metrics.customer_count), "Non-admin Auth accounts"],
              ["Published products", text(metrics.active_products), "Currently visible in catalog"],
              ["Low-stock variants", text(metrics.low_stock_count), "Five units or fewer"],
            ].map(([label, value, foot]) => (
              <article className="admin-metric-card" key={label}>
                <div className="admin-metric-top"><span>{label}</span><span className="admin-metric-icon">↗</span></div>
                <strong className="admin-metric-value">{value}</strong>
                <span className="admin-metric-foot">{foot}</span>
              </article>
            ))}
          </div>

          <div className="admin-overview-grid">
            <section className="admin-panel" aria-label="Sales analytics">
              <div className="admin-panel-heading"><div><h2>Paid sales</h2><p>Revenue excludes unpaid, cancelled and refunded orders.</p></div>
                <form className="admin-period-form" action="/admin" method="get"><label className="sr-only" htmlFor="days">Reporting range</label>
                  <select defaultValue={props.days} id="days" name="days"><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select>
                  <button className="admin-button admin-button-light" type="submit">Apply</button>
                </form>
              </div>
              <div className="admin-chart-total"><strong>{inr(series.reduce((sum, point) => sum + num(point.revenue_inr), 0))}</strong><span>in paid sales over {props.days} days</span></div>
              {series.length ? <div className="admin-chart">
                <div className="admin-chart-grid"><span>{inr(maxSales)}</span><span>{inr(maxSales / 2)}</span><span>₹0</span></div>
                <div className="admin-chart-bars">{series.map((point) => {
                  const height = Math.max(3, num(point.revenue_inr) / maxSales * 100);
                  return <div className="admin-chart-column" key={text(point.date)} title={`${date(point.date)}: ${inr(point.revenue_inr)}`}>
                    <span aria-label={inr(point.revenue_inr)} className="admin-chart-bar" style={{ height: `${height}%` }} />
                    <span className="admin-chart-day">{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(text(point.date)))}</span>
                  </div>;
                })}</div>
              </div> : <div className="admin-empty-state">No sales data is available for this range.</div>}
            </section>
            <section className="admin-panel admin-inventory-panel">
              <div className="admin-panel-heading"><div><h2>Low stock</h2><p>Live stock across active variants.</p></div><a className="admin-text-link" href="#inventory">Manage stock →</a></div>
              <div className="admin-stock-summary"><span className="admin-stock-indicator" />{text(metrics.low_stock_count)} variants need attention</div>
              {lowStock.length ? lowStock.map((item) => (
                <div className="admin-stock-row" key={text(item.variant_id)}>
                  <span className="admin-product-thumb">P</span>
                  <span className="admin-stock-product"><strong>{text(item.product_name)} · {text(item.variant_name)}</strong><span>{text(item.sku)}</span></span>
                  <strong className={`admin-stock-count${num(item.stock_quantity) <= 2 ? " is-low" : ""}`}>{text(item.stock_quantity)} left</strong>
                </div>
              )) : <div className="admin-empty-state">No active low-stock variants.</div>}
            </section>
          </div>

          <Panel title="Best sellers" description="Paid order items by quantity sold.">
            {featuredBestSellers.length ? <div className="admin-list-grid">{featuredBestSellers.map((item) => (
              <div className="admin-list-row" key={text(item.product_name)}><strong>{text(item.product_name)}</strong><span>{text(item.quantity_sold)} sold</span><span>{inr(item.revenue_inr)}</span></div>
            ))}</div> : <div className="admin-empty-state">No eligible paid sales yet.</div>}
          </Panel>

          <SectionHeading eyebrow="CATALOG" title="Products" description="Create, publish, update and archive products and variants." id="products" />
          <Panel title="Create a product" description="Add product details and variant data. Initial variant stock is recorded as an audited inventory movement.">
            <ProductForm categories={props.categories} />
          </Panel>
          <Panel title={`Products (${props.productTotal})`} description="Edit product information, images and variant pricing. Archive instead of deleting products referenced by orders.">
            {props.products.length ? <div className="admin-record-list">{props.products.map((product) => {
              const category = related(product.categories);
              const variants = list(product.product_variants);
              return <details className="admin-record" key={text(product.id)}>
                <summary><span><strong>{text(product.name)}</strong><small>{text(product.brand)} · {text(category.name)} · {text(product.slug)}</small></span>
                  <span>{inr(product.price_inr)}</span><span className={`admin-status-badge status-${text(product.status)}`}><span />{humanize(product.status)}</span></summary>
                <ProductForm categories={props.categories} product={product} />
                {variants.length > 0 && <p className="admin-record-foot">{variants.length} variant(s); current stock: {variants.map((variant) => `${text(variant.sku)} ${num(variant.stock_quantity)}`).join(" · ")}</p>}
              </details>;
            })}</div> : <div className="admin-empty-state">No products are available to manage.</div>}
            <Pager href={productHref} page={props.productPage} pages={productPageCount} />
          </Panel>

          <SectionHeading eyebrow="CATALOG STRUCTURE" title="Categories" description="Manage visibility, display order and image assets for catalog categories." id="categories" />
          <Panel title="Create category" description="Category images are uploaded to the public product-images bucket and are optimized by the storefront.">
            <CategoryForm />
          </Panel>
          <Panel title="Manage categories">
            {props.categories.length ? <div className="admin-record-list">{props.categories.map((category) => (
              <details className="admin-record" key={text(category.id)}>
                <summary><span><strong>{text(category.name)}</strong><small>/{text(category.slug)} · order {text(category.display_order)}</small></span>
                  <span className={`admin-status-badge status-${category.is_active ? "delivered" : "cancelled"}`}><span />{category.is_active ? "Published" : "Archived"}</span></summary>
                <CategoryForm category={category} />
              </details>
            ))}</div> : <div className="admin-empty-state">No categories are available.</div>}
          </Panel>

          <SectionHeading eyebrow="FULFILLMENT" title="Orders" description="Review order details and apply only permitted status transitions." id="orders" />
          <Panel title={`Order management · ${props.orderTotal} matching`} description="Payment states are displayed from verified Supabase records and cannot be manually edited here.">
            <form action="/admin#orders" className="admin-filter-form" method="get">
              <input defaultValue={props.orderSearch} name="orderSearch" placeholder="Search order number or customer email" />
              <select defaultValue={props.orderStatus} name="orderStatus"><option value="">All statuses</option>
                {["pending_payment", "confirmed", "processing", "shipped", "delivered", "cancelled"].map((status) => <option key={status} value={status}>{humanize(status)}</option>)}
              </select>
              <button className="admin-button admin-button-primary" type="submit">Search</button>
            </form>
            {orders.length ? <div className="admin-record-list">{orders.map((order) => {
              const status = text(order.status);
              const canCancel = status === "confirmed" && text(order.payment_method) === "cod" && text(order.payment_status) === "due_on_delivery";
              const canAdvance = status === "confirmed" || status === "processing" || status === "shipped";
              return <details className="admin-record" key={text(order.id)}>
                <summary><span><strong>{text(order.order_number)}</strong><small>{text(order.customer_name) || text(order.customer_email)} · {date(order.created_at)}</small></span>
                  <span>{inr(order.total_inr)}</span><span className={`admin-status-badge status-${status}`}><span />{humanize(status)}</span></summary>
                <div className="admin-order-detail">
                  <div className="admin-order-facts"><span>Customer<strong>{text(order.customer_name) || "Customer"}</strong><small>{text(order.customer_email)}</small></span>
                    <span>Payment<strong>{humanize(order.payment_method)} · {humanize(order.payment_status)}</strong></span>
                    <span>Tracking<strong>{text(order.carrier) || "Not shipped"} {text(order.tracking_number)}</strong></span>
                  </div>
                  <p><strong>Delivery address:</strong> {Object.values(row(order.address_snapshot)).filter((value) => typeof value === "string" && value).join(", ") || "Address snapshot unavailable"}</p>
                  <ul>{list(order.items).map((item, index) => <li key={`${text(order.id)}-${index}`}>{text(item.product_name)} · {text(item.variant_name)} × {text(item.quantity)} — {inr(item.line_total_inr)}</li>)}</ul>
                  <div className="admin-order-timeline">{list(order.status_events).map((event, index) => <span key={`${text(event.status)}-${index}`}>{humanize(event.status)} · {date(event.created_at)}</span>)}</div>
                  {canAdvance ? <form action={updateOrderFulfillment} className="admin-form admin-order-form">
                    <input name="orderId" type="hidden" value={text(order.id)} />
                    <label>Next status<select defaultValue="" name="status" required><option disabled value="">Choose permitted transition</option>
                      {status === "confirmed" && <option value="processing">Processing</option>}
                      {status === "processing" && <option value="shipped">Shipped</option>}
                      {status === "shipped" && <option value="delivered">Delivered</option>}
                      {canCancel && <option value="cancelled">Cancel unpaid COD order</option>}
                    </select></label>
                    <label>Carrier<input defaultValue={text(order.carrier)} maxLength={100} name="carrier" /></label>
                    <label>Tracking number<input defaultValue={text(order.tracking_number)} maxLength={150} name="trackingNumber" /></label>
                    <label>Tracking HTTPS URL<input defaultValue={text(order.tracking_url)} name="trackingUrl" type="url" /></label>
                    <ConfirmAdminSubmit className="admin-button admin-button-primary" confirmField="status" confirmValue="cancelled" message="Cancel this confirmed, unpaid COD order and release its reserved stock?">Update order</ConfirmAdminSubmit>
                  </form> : <p className="admin-record-foot">{status === "pending_payment" ? "Waiting for provider-verified payment; no manual payment override is available." : "No further fulfillment transition is available."}</p>}
                  {list(order.return_requests).map((request) => <ReturnRow key={text(request.id)} request={request} />)}
                  <p className="admin-record-foot">Refunds are never marked complete here. Process any refund through a verified payment-provider workflow first.</p>
                </div>
              </details>;
            })}</div> : <div className="admin-empty-state">No matching orders.</div>}
            <Pager href={orderHref} page={props.orderPage} pages={orderPageCount} />
          </Panel>

          <SectionHeading eyebrow="CUSTOMER CARE" title="Customers" description="Customer details and actual order history from Supabase Auth and commerce tables." id="customers" />
          <Panel title="Customer accounts" description="Only customer email, profile name, registration date, order count and paid lifetime spend are shown.">
            {props.customers.length ? <div className="admin-record-list">{props.customers.map((customer) => {
              const customerId = text(customer.user_id);
              const selected = customerId === props.customerId;
              return <details className="admin-record" key={customerId} open={selected || undefined}>
                <summary><span><strong>{text(customer.full_name) || "Customer"}</strong><small>{text(customer.email)} · joined {date(customer.created_at)}</small></span>
                  <span>{text(customer.orders_count)} orders</span><span>{inr(customer.lifetime_spend_inr)} paid</span></summary>
                <p className="admin-record-foot">Customer ID: {customerId} · Email and account credentials remain managed by Supabase Auth.</p>
                <Link className="admin-button admin-button-light" href={`/admin?customerId=${encodeURIComponent(customerId)}#customers`}>View order history</Link>
                {selected && <CustomerOrderHistory orders={props.customerOrders} />}
              </details>;
            })}</div> : <div className="admin-empty-state">No customer accounts found.</div>}
            <Pager href={customerHref} page={props.customerPage} pages={customerPageCount} />
          </Panel>

          <SectionHeading eyebrow="INVENTORY" title="Stock and adjustments" description="Every quantity change is atomic, attributed to the signed-in administrator and recorded with a reason." id="inventory" />
          <Panel title="Active variants" description="Use positive numbers to add stock and negative numbers to remove stock. Stock cannot fall below zero.">
            <div className="admin-inventory-adjust-list">{props.products.flatMap((product) => list(product.product_variants).map((variant) => ({ product, variant }))).map(({ product, variant }) => (
              <form action={adjustInventory} className="admin-inventory-adjust" key={text(variant.id)}>
                <input name="variantId" type="hidden" value={text(variant.id)} />
                <span><strong>{text(product.name)} · {text(variant.name)}</strong><small>{text(variant.sku)} · {text(variant.stock_quantity)} in stock</small></span>
                <label>Change<input max="100000" min="-100000" name="delta" required type="number" /></label>
                <label>Reason<input maxLength={500} minLength={5} name="note" placeholder="Stock count correction" required /></label>
                <button className="admin-button admin-button-primary" type="submit">Adjust</button>
              </form>
            ))}</div>
            {!props.products.some((product) => list(product.product_variants).length > 0) && <div className="admin-empty-state">No variants are available on this product page.</div>}
          </Panel>
          <Panel title="Recent inventory movements" description="Audit history for order reservations, releases and admin adjustments.">
            {props.inventory.length ? <div className="admin-list-grid">{props.inventory.map((movement) => {
              const variant = related(movement.product_variants);
              const product = related(variant.products);
              return <div className="admin-list-row" key={text(movement.id)}>
                <strong>{text(product.name)} · {text(variant.sku)}</strong><span>{num(movement.quantity_change) > 0 ? "+" : ""}{text(movement.quantity_change)}</span>
                <span>{humanize(movement.reason)} · {text(movement.note) || "—"} · {date(movement.created_at)}</span>
              </div>;
            })}</div> : <div className="admin-empty-state">No inventory movements have been recorded.</div>}
          </Panel>

          <SectionHeading eyebrow="PROMOTIONS" title="Coupons" description="Create and update coupon rules used by the server-side checkout validator." id="coupons" />
          <Panel title="Create coupon"><CouponForm /></Panel>
          <Panel title="Manage coupons">
            {props.coupons.length ? <div className="admin-record-list">{props.coupons.map((coupon) => (
              <details className="admin-record" key={text(coupon.id)}>
                <summary><span><strong>{text(coupon.code)}</strong><small>{text(coupon.discount_value)} {text(coupon.discount_type)} · minimum {inr(coupon.minimum_subtotal_inr)}</small></span>
                  <span className={`admin-status-badge status-${coupon.is_active ? "delivered" : "cancelled"}`}><span />{coupon.is_active ? "Active" : "Inactive"}</span></summary>
                <CouponForm coupon={coupon} />
              </details>
            ))}</div> : <div className="admin-empty-state">No coupons configured.</div>}
          </Panel>

          <SectionHeading eyebrow="AFTER-SALES" title="Returns and refunds" description="Manage request status only. A return approval does not perform a refund." id="returns" />
          <Panel title="Return requests" description="Review the reason and order reference, then update the request status.">
            {props.returns.length ? <div className="admin-record-list">{props.returns.map((request) => <ReturnRow key={text(request.id)} request={request} />)}</div> : <div className="admin-empty-state">No customer return requests.</div>}
            <div className="admin-alert">Refunds require a verified payment-provider operation and are not available as a manual status edit.</div>
          </Panel>

          <SectionHeading eyebrow="MODERATION" title="Product reviews" description="Approve or reject customer-submitted reviews; only verified purchasers can submit reviews." id="reviews" />
          <Panel title="Review moderation">
            {props.reviews.length ? <div className="admin-record-list">{props.reviews.map((review) => (
              <div className="admin-review-row" key={text(review.id)}>
                <div><strong>{text(review.title) || `${text(review.rating)} star review`}</strong><p>{text(review.body)}</p><small>Product {text(review.product_id)} · Customer {text(review.user_id)} · {date(review.created_at)} · {humanize(review.status)}</small></div>
                {text(review.status) === "pending" && <form action={moderateReview} className="admin-inline-actions">
                  <input name="reviewId" type="hidden" value={text(review.id)} />
                  <button className="admin-button admin-button-primary" name="status" type="submit" value="approved">Approve</button>
                  <ConfirmAdminSubmit className="admin-button admin-button-light" message="Reject this customer review?" name="status" value="rejected">Reject</ConfirmAdminSubmit>
                </form>}
              </div>
            ))}</div> : <div className="admin-empty-state">No reviews are awaiting or requiring moderation.</div>}
          </Panel>

          <SectionHeading eyebrow="STORE CONFIGURATION" title="Homepage and business settings" description="Changes to public homepage content and checkout availability take effect immediately after saving." id="settings" />
          <Panel title="Store, delivery, payment and homepage content" description="COD and Razorpay remain separate switches; enable them only after the operational setup is ready.">
            <form action={saveStoreSettings} className="admin-form admin-settings-form">
              <label>Store name<input defaultValue={text(props.settings.store_name, "Sachin Brands")} maxLength={100} name="storeName" required /></label>
              <label>Support email<input defaultValue={text(props.settings.support_email)} name="supportEmail" type="email" /></label>
              <label>Support phone<input defaultValue={text(props.settings.support_phone)} maxLength={30} name="supportPhone" /></label>
              <label>Shipping fee (INR)<input defaultValue={text(props.settings.shipping_fee_inr)} min="0" name="shippingFee" required step="0.01" type="number" /></label>
              <label>Free shipping threshold (INR)<input defaultValue={text(props.settings.free_shipping_threshold_inr)} min="0" name="freeShippingThreshold" step="0.01" type="number" /></label>
              <label>Tax rate (%)<input defaultValue={text(props.settings.tax_rate_percent)} min="0" max="100" name="taxRate" required step="0.01" type="number" /></label>
              <label>Return window (days)<input defaultValue={text(props.settings.return_window_days, "30")} min="0" max="365" name="returnWindowDays" required type="number" /></label>
              <label className="admin-checkbox"><input defaultChecked={props.settings.cod_enabled === true} name="codEnabled" type="checkbox" /> Enable Cash on Delivery</label>
              <label className="admin-checkbox"><input defaultChecked={props.settings.razorpay_enabled === true} disabled={!props.razorpayConfigured && props.settings.razorpay_enabled !== true} name="razorpayEnabled" type="checkbox" /> Enable Razorpay</label>
              {!props.razorpayConfigured && <p className="admin-field-wide admin-record-foot">Razorpay server keys are not configured in this deployment, so new online checkouts cannot be enabled.</p>}
              <label className="admin-field-wide">Hero headline<input defaultValue={text(props.storefront.hero_headline)} maxLength={200} name="heroHeadline" required /></label>
              <label className="admin-field-wide">Hero description<textarea defaultValue={text(props.storefront.hero_description)} maxLength={1000} name="heroDescription" rows={3} /></label>
              <label>Hero CTA label<input defaultValue={text(props.storefront.hero_cta_label, "Shop now")} maxLength={50} name="heroCtaLabel" required /></label>
              <label>Hero CTA path<input defaultValue={text(props.storefront.hero_cta_url, "/products")} name="heroCtaUrl" pattern="/(?!/).*" required /></label>
              <label className="admin-field-wide">Hero image URL<input defaultValue={text(props.storefront.hero_image_url)} name="heroImageUrl" type="url" /></label>
              <label className="admin-field-wide">Featured category IDs (comma or space separated)
                <textarea defaultValue={featuredIds(props.storefront.featured_category_ids)} name="featuredCategoryIds" placeholder={props.categories.slice(0, 2).map((item) => text(item.id)).join(", ")} rows={2} />
                <small>Choose IDs from the active categories below. Leave blank to use the default category order.</small>
              </label>
              <label className="admin-field-wide">Featured product IDs (comma or space separated)
                <textarea defaultValue={featuredIds(props.storefront.featured_product_ids)} name="featuredProductIds" placeholder={props.products.slice(0, 2).map((item) => text(item.id)).join(", ")} rows={2} />
                <small>Featured IDs must belong to published products. Product ID appears in the editor summary.</small>
              </label>
              <label className="admin-field-wide">Promotion headline<input defaultValue={text(props.storefront.promotion_headline)} maxLength={150} name="promotionHeadline" /></label>
              <label className="admin-field-wide">Promotion text<textarea defaultValue={text(props.storefront.promotion_body)} maxLength={1000} name="promotionBody" rows={3} /></label>
              <label>Promotion CTA label<input defaultValue={text(props.storefront.promotion_cta_label) || "Explore products"} maxLength={40} name="promotionCtaLabel" required /></label>
              <label>Promotion CTA path<input defaultValue={text(props.storefront.promotion_cta_url) || "/products"} maxLength={200} name="promotionCtaUrl" required /></label>
              <label className="admin-field-wide">Promotion image URL<input defaultValue={text(props.storefront.promotion_image_url)} name="promotionImageUrl" type="url" /></label>
              <label className="admin-field-wide">Shipping policy<textarea defaultValue={text(props.storefront.shipping_policy)} maxLength={5000} name="shippingPolicy" rows={4} /></label>
              <label className="admin-field-wide">Returns policy<textarea defaultValue={text(props.storefront.return_policy)} maxLength={5000} name="returnPolicy" rows={4} /></label>
              <button className="admin-button admin-button-primary" type="submit">Save store settings</button>
            </form>
          </Panel>
          <footer className="admin-footer"><span>Protected by Supabase RLS and database role checks.</span><Link href="/">Return to storefront</Link></footer>
        </div>
      </main>
    </div>
  );
}

function CategoryForm({ category }: { category?: AdminRow }) {
  return (
    <form action={saveCategory} className="admin-form admin-category-form" encType="multipart/form-data">
      {category && <input name="id" type="hidden" value={text(category.id)} />}
      <label>Name<input defaultValue={text(category?.name)} maxLength={100} name="name" required /></label>
      <label>Slug<input defaultValue={text(category?.slug)} name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" required /></label>
      <label>Display order<input defaultValue={text(category?.display_order, "0")} min="0" name="displayOrder" type="number" /></label>
      <label>Public image URL<input defaultValue={text(category?.image_url)} name="imageUrl" type="url" /></label>
      <label>Upload category image<input accept="image/jpeg,image/png,image/webp,image/avif" name="image" type="file" /></label>
      <label className="admin-field-wide">Description<textarea defaultValue={text(category?.description)} maxLength={1000} name="description" rows={2} /></label>
      <label className="admin-checkbox"><input defaultChecked={category?.is_active !== false} name="isActive" type="checkbox" /> Published</label>
      <ConfirmAdminSubmit className="admin-button admin-button-primary" confirmUncheckedField="isActive" message="Archive this category and hide it from the storefront?">{category ? "Save category" : "Create category"}</ConfirmAdminSubmit>
    </form>
  );
}

function CouponForm({ coupon }: { coupon?: AdminRow }) {
  return (
    <form action={saveCoupon} className="admin-form admin-coupon-form">
      {coupon && <input name="id" type="hidden" value={text(coupon.id)} />}
      <label>Code<input defaultValue={text(coupon?.code)} maxLength={40} name="code" pattern="[A-Za-z0-9_-]{3,40}" required /></label>
      <label>Discount type<select defaultValue={text(coupon?.discount_type, "percent")} name="discountType"><option value="percent">Percentage</option><option value="fixed">Fixed INR</option></select></label>
      <label>Discount value<input defaultValue={text(coupon?.discount_value)} min="0.01" name="discountValue" required step="0.01" type="number" /></label>
      <label>Minimum subtotal (INR)<input defaultValue={text(coupon?.minimum_subtotal_inr, "0")} min="0" name="minimumSubtotal" step="0.01" type="number" /></label>
      <label>Maximum discount (INR)<input defaultValue={text(coupon?.maximum_discount_inr)} min="0" name="maximumDiscount" step="0.01" type="number" /></label>
      <label>Total usage limit<input defaultValue={text(coupon?.usage_limit)} min="1" name="usageLimit" type="number" /></label>
      <label>Per-customer limit<input defaultValue={text(coupon?.per_user_limit, "1")} min="1" name="perUserLimit" required type="number" /></label>
      <label>Starts at<input defaultValue={dateInput(coupon?.starts_at)} name="startsAt" required type="datetime-local" /></label>
      <label>Expires at<input defaultValue={dateInput(coupon?.expires_at)} name="expiresAt" type="datetime-local" /></label>
      <label className="admin-checkbox"><input defaultChecked={coupon?.is_active === true} name="isActive" type="checkbox" /> Active</label>
      <ConfirmAdminSubmit className="admin-button admin-button-primary" confirmUncheckedField="isActive" message="Deactivate this coupon? Existing completed orders will remain unchanged.">{coupon ? "Save coupon" : "Create coupon"}</ConfirmAdminSubmit>
    </form>
  );
}

function ReturnRow({ request }: { request: AdminRow }) {
  const status = text(request.status);
  return (
    <div className="admin-review-row">
      <div><strong>Return request · order {text(request.order_id)}</strong><p>{text(request.reason)}</p><small>Customer {text(request.user_id)} · {date(request.created_at)} · {humanize(status)}</small></div>
      {status !== "closed" && status !== "rejected" && <form action={updateReturnStatus} className="admin-inline-actions">
        <input name="returnId" type="hidden" value={text(request.id)} />
        {status === "pending" && <><button className="admin-button admin-button-primary" name="status" type="submit" value="approved">Approve request</button><ConfirmAdminSubmit className="admin-button admin-button-light" message="Reject this return request?" name="status" value="rejected">Reject</ConfirmAdminSubmit></>}
        {status === "approved" && <button className="admin-button admin-button-primary" name="status" type="submit" value="received">Mark received</button>}
        {status === "received" && <button className="admin-button admin-button-primary" name="status" type="submit" value="closed">Close request</button>}
      </form>}
    </div>
  );
}

function CustomerOrderHistory({ orders }: { orders: AdminRow[] }) {
  return <div className="admin-customer-orders">
    <strong>Order history</strong>
    {orders.length ? orders.map((order) => <div key={text(order.id)}><span>{text(order.order_number)} · {date(order.created_at)}</span><span>{humanize(order.status)} · {humanize(order.payment_status)}</span><strong>{inr(order.total_inr)}</strong></div>) : <p>This customer has no orders.</p>}
  </div>;
}
