import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SITE_LOGO_PATH, SITE_NAME } from "@/config/site";
import { prisma } from "@/lib/prisma";
import { logout } from "./actions";

export const metadata: Metadata = {
  title: "My account",
  description: "Manage your customer account and recent orders.",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user.id) {
    redirect("/login?callbackUrl=%2Faccount");
  }

  const customer = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      createdAt: true,
      orders: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          createdAt: true,
          items: {
            select: { productName: true, quantity: true },
          },
        },
      },
      addresses: {
        where: { isDefault: true },
        take: 1,
        select: { name: true, line1: true, city: true, state: true, postalCode: true, country: true },
      },
    },
  });

  if (!customer) {
    redirect("/login");
  }

  const firstName = customer.name.trim().split(/\s+/)[0] || "there";
  const defaultAddress = customer.addresses[0];

  return (
    <main className="account-page">
      <header className="account-header">
        <Link aria-label={`${SITE_NAME} home`} className="auth-brand" href="/">
          <Image alt="" height={34} priority src={SITE_LOGO_PATH} width={34} />
          <span>{SITE_NAME}</span>
        </Link>
        <nav aria-label="Account navigation" className="account-nav">
          <Link href="#account-orders">Orders</Link>
          <Link href="#account-details">Account details</Link>
          <form action={logout}><button type="submit">Sign out</button></form>
        </nav>
      </header>

      <section aria-labelledby="account-heading" className="account-welcome">
        <p className="auth-eyebrow">YOUR ACCOUNT</p>
        <h1 id="account-heading">Welcome back, {firstName}.</h1>
        <p>Everything you need, all in one thoughtful place.</p>
      </section>

      <div className="account-layout">
        <section aria-labelledby="account-orders-title" className="account-panel" id="account-orders">
          <div className="account-panel-heading">
            <div>
              <span className="account-section-label">YOUR PURCHASES</span>
              <h2 id="account-orders-title">Recent orders</h2>
            </div>
            <span className="account-order-count">{customer.orders.length} recent</span>
          </div>

          {customer.orders.length ? (
            <div className="account-orders">
              {customer.orders.map((order) => (
                <article className="account-order" key={order.id}>
                  <div className="account-order-heading">
                    <div>
                      <strong>Order {order.orderNumber}</strong>
                      <span>{order.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                    <span className={`account-order-status account-status-${order.status.toLowerCase()}`}>{formatStatus(order.status)}</span>
                  </div>
                  <div className="account-order-bottom">
                    <span>{order.items.reduce((quantity, item) => quantity + item.quantity, 0)} items</span>
                    <strong>{formatCurrency(Number(order.total))}</strong>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="account-empty-orders">
              <span aria-hidden="true" className="account-empty-icon">✳</span>
              <h3>Your next favorite is out there.</h3>
              <p>Your orders will find a home here when you&apos;re ready.</p>
              <Link className="account-shop-link" href="/">Explore the collection <span aria-hidden="true">→</span></Link>
            </div>
          )}
        </section>

        <aside className="account-side-column">
          <section aria-labelledby="account-details-title" className="account-panel" id="account-details">
            <div className="account-panel-heading account-details-heading">
              <div>
                <span className="account-section-label">YOUR INFORMATION</span>
                <h2 id="account-details-title">Account details</h2>
              </div>
              <span aria-hidden="true" className="account-profile-avatar">{firstName.slice(0, 1).toUpperCase()}</span>
            </div>
            <dl className="account-detail-list">
              <div><dt>Name</dt><dd>{customer.name}</dd></div>
              <div><dt>Email</dt><dd>{customer.email}</dd></div>
              <div><dt>Member since</dt><dd>{customer.createdAt.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</dd></div>
            </dl>
          </section>

          <section aria-labelledby="account-address-title" className="account-panel">
            <div className="account-panel-heading">
              <div>
                <span className="account-section-label">DELIVERY</span>
                <h2 id="account-address-title">Default address</h2>
              </div>
              <span aria-hidden="true" className="account-address-icon">⌂</span>
            </div>
            {defaultAddress ? (
              <address className="account-address">
                <strong>{defaultAddress.name}</strong>
                <span>{defaultAddress.line1}</span>
                <span>{defaultAddress.city}, {defaultAddress.state} {defaultAddress.postalCode}</span>
                <span>{defaultAddress.country}</span>
              </address>
            ) : (
              <p className="account-no-address">Add a delivery address during your next checkout.</p>
            )}
          </section>

          <div className="account-help-card">
            <span aria-hidden="true">♡</span>
            <div><strong>We&apos;re here to help.</strong><a href="mailto:support@example.com">Get in touch with our team</a></div>
          </div>
        </aside>
      </div>

      <footer className="account-footer">© {new Date().getFullYear()} {SITE_NAME} <span>·</span> Considered essentials for everyday living.</footer>
    </main>
  );
}
