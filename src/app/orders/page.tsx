import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatPrice } from "@/data/catalog-types";
import { Icon } from "@/components/storefront/icon";
import { PageHeading } from "@/components/storefront/page-heading";
import { ResumePaymentButton } from "@/components/storefront/resume-payment-button";
import { StorefrontLayout } from "@/components/storefront/storefront-layout";
import { createReadOnlyClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "My orders",
  description: "View your Sachin Brands order references and payment status.",
};

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_inr: number | string;
  created_at: string;
  address_snapshot: {
    recipient_name?: string;
    city?: string;
    state?: string;
  };
};

export default async function OrdersPage() {
  let supabase: Awaited<ReturnType<typeof createReadOnlyClient>>;
  try {
    supabase = await createReadOnlyClient();
  } catch (error) {
    console.error("Supabase is not configured for order history:", error);
    return (
      <StorefrontLayout active="profile">
        <PageHeading eyebrow="Your account" title="My orders" description="Track real order references and their payment status." />
        <div className="sb-empty-page" role="alert"><h2>Supabase setup required</h2><p>Apply the commerce migration and configure Supabase before loading orders.</p></div>
      </StorefrontLayout>
    );
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) console.error("Could not verify order history session:", authError.message);
  if (!user) redirect("/login?callbackUrl=%2Forders");

  const { data, error } = await supabase
    .from("orders")
    .select("id,order_number,status,payment_status,payment_method,total_inr,created_at,address_snapshot")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) console.error("Could not load customer order history:", error.message);
  const orders = (data ?? []) as OrderRow[];
  const orderIds = orders.map((order) => order.id);
  const { data: itemRows, error: itemError } = orderIds.length
    ? await supabase.from("order_items").select("order_id,product_name,variant_name,quantity").in("order_id", orderIds)
    : { data: [], error: null };
  if (itemError) console.error("Could not load ordered items for history:", itemError.message);
  const itemsByOrder = new Map<string, typeof itemRows>();
  for (const item of itemRows ?? []) {
    const current = itemsByOrder.get(item.order_id) ?? [];
    current.push(item);
    itemsByOrder.set(item.order_id, current);
  }
  const razorpayCanResume = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

  return (
    <StorefrontLayout active="profile">
      <PageHeading eyebrow="Your account" title="My orders" description="Your latest order references and current payment status." />
      {error ? (
        <div className="sb-empty-page" role="alert"><h2>Order history unavailable</h2><p>We could not load orders from Supabase. Apply the checkout migration and check the order read policy.</p></div>
      ) : orders.length === 0 ? (
        <div className="sb-empty-page"><span className="sb-empty-icon"><Icon name="cart" size={24} /></span><h2>No orders yet</h2><p>Orders placed with this signed-in account will appear here.</p><Link className="sb-button sb-button-primary" href="/products">Explore products</Link></div>
      ) : (
        <section className="sb-order-history" aria-label="Order history">
          {orders.map((order) => (
            <article className="sb-order-history-card" key={order.id}>
              <div>
                <span className="sb-eyebrow">{new Date(order.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}</span>
                <h2>{order.order_number}</h2>
                <p>
                  <span className={`sb-order-status${["confirmed", "processing", "shipped", "delivered"].includes(order.status) ? " is-confirmed" : ""}`}>{order.status.replace(/_/g, " ")}</span>
                  <span>{order.payment_method === "cod" ? "Cash on Delivery" : "Razorpay"}</span>
                  <span>Payment: {order.payment_status.replace(/_/g, " ")}</span>
                  <span>Delivering to: {order.address_snapshot?.city ?? "Saved address"}{order.address_snapshot?.state ? `, ${order.address_snapshot.state}` : ""}</span>
                  <span>{(itemsByOrder.get(order.id) ?? []).map((item) => `${item.product_name} (${item.variant_name}) × ${item.quantity}`).join(" · ") || "Order item details unavailable"}</span>
                </p>
              </div>
              <div className="sb-order-history-actions">
                <strong>{formatPrice(Number(order.total_inr))}</strong>
                {order.status === "pending_payment" && order.payment_method === "razorpay" && razorpayCanResume && (
                  <ResumePaymentButton orderId={order.id} />
                )}
                <Link className="sb-button sb-button-outline" href={`/orders/${encodeURIComponent(order.order_number)}`}>Track order <Icon name="arrow" size={16} /></Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </StorefrontLayout>
  );
}
