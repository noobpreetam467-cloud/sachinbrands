"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { SITE_LOGO_PATH, SITE_NAME } from "@/config/site";

type IconName =
  | "overview"
  | "orders"
  | "products"
  | "customers"
  | "analytics"
  | "search"
  | "arrow"
  | "download"
  | "external"
  | "more";

type Order = {
  id: string;
  customer: string;
  email: string;
  date: string;
  total: number;
  status: "Paid" | "Processing" | "Shipped" | "Delivered";
};

const orders: Order[] = [
  { id: "#1048", customer: "Avery Morgan", email: "avery.morgan@example.com", date: "Oct 15, 2026", total: 128.0, status: "Processing" },
  { id: "#1047", customer: "Jordan Lee", email: "jordan.lee@example.com", date: "Oct 15, 2026", total: 84.5, status: "Paid" },
  { id: "#1046", customer: "Riley Taylor", email: "riley.taylor@example.com", date: "Oct 14, 2026", total: 216.0, status: "Shipped" },
  { id: "#1045", customer: "Casey Brooks", email: "casey.brooks@example.com", date: "Oct 14, 2026", total: 56.0, status: "Delivered" },
  { id: "#1044", customer: "Morgan Ellis", email: "morgan.ellis@example.com", date: "Oct 13, 2026", total: 142.0, status: "Paid" },
];

const products = [
  { name: "Hand-thrown Stoneware Vase", category: "Home & Living", sku: "HOM-1042", stock: 8, price: 48 },
  { name: "Organic Cotton Bath Towel", category: "Textiles", sku: "TEX-2081", stock: 5, price: 36 },
  { name: "Acacia Serving Board", category: "Kitchen", sku: "KIT-3015", stock: 3, price: 42 },
  { name: "Everyday Canvas Pouch", category: "Accessories", sku: "ACC-4022", stock: 14, price: 24 },
];

const sales = [
  { day: "Thu", amount: "$1.2k", height: 40 },
  { day: "Fri", amount: "$1.8k", height: 62 },
  { day: "Sat", amount: "$1.4k", height: 48 },
  { day: "Sun", amount: "$2.1k", height: 74 },
  { day: "Mon", amount: "$1.6k", height: 56 },
  { day: "Tue", amount: "$2.4k", height: 88 },
  { day: "Wed", amount: "$1.9k", height: 68 },
];

const navigation: { label: string; href: string; icon: IconName }[] = [
  { label: "Overview", href: "#overview", icon: "overview" },
  { label: "Orders", href: "#orders", icon: "orders" },
  { label: "Products", href: "#products", icon: "products" },
  { label: "Customers", href: "#customers", icon: "customers" },
  { label: "Analytics", href: "#analytics", icon: "analytics" },
];

const iconPaths: Record<IconName, ReactNode> = {
  overview: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  orders: <><path d="M5 4.5h14v16H5z" /><path d="M8.5 8h7M8.5 12h7M8.5 16h4" /></>,
  products: <><path d="m12 3 8.5 4.5v9L12 21l-8.5-4.5v-9L12 3Z" /><path d="m3.8 7.7 8.2 4.5 8.2-4.5M12 12.2V21" /></>,
  customers: <><path d="M16 20v-1.5a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4V20" /><circle cx="10" cy="7.5" r="3.5" /><path d="M17 4.3a3.5 3.5 0 0 1 0 6.8M20 20v-1.5a4 4 0 0 0-2.8-3.8" /></>,
  analytics: <><path d="M4 19.5h16" /><path d="M6.5 16V10m5.5 6V5m5.5 11v-8" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 4 4" /></>,
  arrow: <><path d="M5 12h14m-6-6 6 6-6 6" /></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 17v3h14v-3" /></>,
  external: <><path d="M14 4h6v6m-10 4L20 4" /><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6" /></>,
  more: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.6"
      viewBox="0 0 24 24"
      width={size}
    >
      {iconPaths[name]}
    </svg>
  );
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount);
}

function exportOrders(rows: Order[]) {
  const escapeCell = (value: string | number) =>
    `"${String(value).replaceAll('"', '""')}"`;
  const csv = [
    ["Order", "Customer", "Email", "Date", "Total", "Status"],
    ...rows.map((order) => [
      order.id,
      order.customer,
      order.email,
      order.date,
      order.total.toFixed(2),
      order.status,
    ]),
  ]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "store-orders.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminDashboard() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const query = search.trim().toLocaleLowerCase();

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const matchesSearch =
          !query ||
          `${order.id} ${order.customer} ${order.email}`.toLocaleLowerCase().includes(query);
        return matchesSearch && (status === "All statuses" || order.status === status);
      }),
    [query, status],
  );

  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        `${product.name} ${product.category} ${product.sku}`.toLocaleLowerCase().includes(query),
      ),
    [query],
  );

  return (
    <div className="admin-shell" id="overview">
      <aside className="admin-sidebar">
        <Link aria-label={`${SITE_NAME} storefront`} className="admin-brand" href="/">
          <Image alt="" height={34} priority src={SITE_LOGO_PATH} width={34} />
          <span>{SITE_NAME}</span>
        </Link>

        <div className="admin-store-label">STORE MANAGEMENT</div>
        <nav aria-label="Admin navigation" className="admin-navigation">
          {navigation.map((item, index) => (
            <a
              aria-current={index === 0 ? "page" : undefined}
              className={`admin-nav-link${index === 0 ? " is-active" : ""}`}
              href={item.href}
              key={item.label}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
              {item.label === "Orders" && <span className="admin-nav-count">12</span>}
            </a>
          ))}
        </nav>

        <div className="admin-sidebar-bottom">
          <div className="admin-profile">
            <div aria-hidden="true" className="admin-avatar">SA</div>
            <div className="admin-profile-copy">
              <strong>Store admin</strong>
              <span>Administrator</span>
            </div>
            <Icon name="more" />
          </div>
          <Link className="admin-back-link" href="/">
            <Icon name="external" />
            <span>View storefront</span>
          </Link>
        </div>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div className="admin-breadcrumb">
            <span>Store</span>
            <span aria-hidden="true">/</span>
            <strong>Overview</strong>
          </div>
          <label className="admin-search">
            <Icon name="search" size={17} />
            <span className="sr-only">Search orders and products</span>
            <input
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search orders, products..."
              type="search"
              value={search}
            />
            <kbd>⌘ K</kbd>
          </label>
          <Link className="admin-store-link" href="/">
            <span>View store</span>
            <Icon name="external" size={16} />
          </Link>
        </header>

        <div className="admin-content">
          <section aria-labelledby="page-title" className="admin-page-heading">
            <div>
              <div className="admin-eyebrow">WEDNESDAY, OCTOBER 15</div>
              <h1 id="page-title">Good morning, Store admin <span aria-hidden="true">✳</span></h1>
              <p>Here&apos;s what&apos;s happening with your store today.</p>
            </div>
            <button
              className="admin-button admin-button-primary"
              onClick={() => exportOrders(filteredOrders)}
              type="button"
            >
              <Icon name="download" size={16} />
              Export orders
            </button>
          </section>

          <div aria-label="Sample data preview" className="admin-demo-banner" role="note">
            <span aria-hidden="true" className="admin-demo-dot" />
            Preview dashboard <span className="admin-demo-divider">·</span> Sample data
            <span className="admin-demo-copy">Connect your store data to see live metrics and orders.</span>
          </div>

          <section aria-label="Store performance" className="admin-metrics">
            <article className="admin-metric-card">
              <div className="admin-metric-top"><span>Total sales</span><span className="admin-metric-icon">$</span></div>
              <strong className="admin-metric-value">$12,486.80</strong>
              <div className="admin-metric-foot"><span className="admin-trend">↗ 12.8%</span><span>vs. last week</span></div>
            </article>
            <article className="admin-metric-card">
              <div className="admin-metric-top"><span>Orders</span><span className="admin-metric-icon"><Icon name="orders" size={17} /></span></div>
              <strong className="admin-metric-value">184</strong>
              <div className="admin-metric-foot"><span className="admin-trend">↗ 8.2%</span><span>vs. last week</span></div>
            </article>
            <article className="admin-metric-card" id="customers">
              <div className="admin-metric-top"><span>Customers</span><span className="admin-metric-icon"><Icon name="customers" size={17} /></span></div>
              <strong className="admin-metric-value">62</strong>
              <div className="admin-metric-foot"><span className="admin-trend">↗ 4.6%</span><span>new this week</span></div>
            </article>
            <article className="admin-metric-card">
              <div className="admin-metric-top"><span>Conversion rate</span><span className="admin-metric-icon"><Icon name="analytics" size={17} /></span></div>
              <strong className="admin-metric-value">3.6%</strong>
              <div className="admin-metric-foot"><span className="admin-trend">↗ 0.4%</span><span>vs. last week</span></div>
            </article>
          </section>

          <section aria-label="Sales and inventory" className="admin-overview-grid">
            <article aria-labelledby="sales-title" className="admin-panel" id="analytics">
              <div className="admin-panel-heading">
                <div>
                  <h2 id="sales-title">Sales overview</h2>
                  <p>A look at your store&apos;s performance</p>
                </div>
                <span className="admin-period">Last 7 days <span aria-hidden="true">⌄</span></span>
              </div>
              <div className="admin-chart-total">
                <strong>$12,486.80</strong>
                <span className="admin-trend">↗ 12.8%</span>
                <span>compared to $11,067 last week</span>
              </div>
              <div aria-label="Sales over the last seven days" className="admin-chart" role="img">
                <div aria-hidden="true" className="admin-chart-grid">
                  <span>$2.5k</span><span>$2.0k</span><span>$1.5k</span><span>$1.0k</span>
                </div>
                <div className="admin-chart-bars">
                  {sales.map((point, index) => (
                    <div className="admin-chart-column" key={point.day}>
                      <span className={`admin-chart-bar${index === 5 ? " is-highlighted" : ""}`} style={{ height: `${point.height}%` }} title={`${point.day}: ${point.amount}`} />
                      <span className="admin-chart-day">{point.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article aria-labelledby="inventory-title" className="admin-panel admin-inventory-panel">
              <div className="admin-panel-heading">
                <div>
                  <h2 id="inventory-title">Inventory watch</h2>
                  <p>Products running low on stock</p>
                </div>
                <a aria-label="Jump to product inventory" className="admin-icon-button" href="#products"><Icon name="arrow" size={17} /></a>
              </div>
              <div className="admin-stock-summary"><span className="admin-stock-indicator" /> 3 products need attention</div>
              <div className="admin-stock-list">
                {products.slice(0, 3).map((product) => (
                  <div className="admin-stock-row" key={product.sku}>
                    <div aria-hidden="true" className="admin-product-thumb">{product.name.slice(0, 1)}</div>
                    <div className="admin-stock-product"><strong>{product.name}</strong><span>{product.category}</span></div>
                    <span className={`admin-stock-count${product.stock <= 5 ? " is-low" : ""}`}>{product.stock} left</span>
                  </div>
                ))}
              </div>
              <a className="admin-text-link" href="#products">View inventory <Icon name="arrow" size={15} /></a>
            </article>
          </section>

          <section aria-labelledby="orders-title" className="admin-panel admin-table-panel" id="orders">
            <div className="admin-panel-heading admin-table-heading">
              <div>
                <h2 id="orders-title">Recent orders</h2>
                <p>Keep track of your latest customer orders</p>
              </div>
              <div className="admin-table-actions">
                <label className="admin-status-select">
                  <span className="sr-only">Filter orders by status</span>
                  <select onChange={(event) => setStatus(event.target.value)} value={status}>
                    <option>All statuses</option>
                    <option>Paid</option>
                    <option>Processing</option>
                    <option>Shipped</option>
                    <option>Delivered</option>
                  </select>
                </label>
                <button className="admin-button admin-button-light" onClick={() => exportOrders(filteredOrders)} type="button">
                  <Icon name="download" size={15} /> Export
                </button>
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Order</th><th>Customer</th><th>Date</th><th>Total</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="admin-order-id">{order.id}</td>
                      <td><div className="admin-customer-cell"><span aria-hidden="true" className="admin-customer-avatar">{order.customer.split(" ").map((part) => part[0]).join("")}</span><span><strong>{order.customer}</strong><small>{order.email}</small></span></div></td>
                      <td>{order.date}</td>
                      <td className="admin-order-total">{formatCurrency(order.total)}</td>
                      <td><span className={`admin-status-badge status-${order.status.toLocaleLowerCase()}`}><span />{order.status}</span></td>
                      <td><button aria-label={`More actions for order ${order.id}`} className="admin-icon-button" type="button"><Icon name="more" /></button></td>
                    </tr>
                  ))}
                  {filteredOrders.length === 0 && (
                    <tr><td className="admin-empty-state" colSpan={6}>No orders match your search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="admin-table-footer"><span>Showing {filteredOrders.length} of {orders.length} orders</span><a className="admin-text-link" href="#orders">View all orders <Icon name="arrow" size={15} /></a></div>
          </section>

          <section aria-labelledby="products-title" className="admin-panel admin-table-panel" id="products">
            <div className="admin-panel-heading admin-table-heading">
              <div>
                <h2 id="products-title">Product inventory</h2>
                <p>Stock levels for your best-selling products</p>
              </div>
              <a className="admin-button admin-button-light" href="#products">View catalog <Icon name="arrow" size={15} /></a>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Product</th><th>SKU</th><th>Category</th><th>Price</th><th>Stock</th></tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.sku}>
                      <td className="admin-product-name"><span aria-hidden="true" className="admin-product-thumb">{product.name.slice(0, 1)}</span><strong>{product.name}</strong></td>
                      <td>{product.sku}</td><td>{product.category}</td>
                      <td className="admin-order-total">{formatCurrency(product.price)}</td>
                      <td><span className={`admin-stock-count${product.stock <= 5 ? " is-low" : ""}`}>{product.stock} in stock</span></td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr><td className="admin-empty-state" colSpan={5}>No products match your search.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <footer className="admin-footer">
            <span>Made for thoughtful commerce.</span>
            <a href="#overview">Back to top ↑</a>
          </footer>
        </div>
      </main>
    </div>
  );
}
