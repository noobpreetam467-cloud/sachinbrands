import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatPrice } from "@/data/catalog-types";
import { Icon } from "@/components/storefront/icon";
import { PageHeading } from "@/components/storefront/page-heading";
import { StorefrontLayout } from "@/components/storefront/storefront-layout";
import { createReadOnlyClient } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Order status" };

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  subtotal_inr: number | string;
  discount_inr: number | string;
  shipping_inr: number | string;
  tax_inr: number | string;
  total_inr: number | string;
  created_at: string;
};

export default async function OrderConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  if (!ref || ref.length > 40) redirect("/account?section=orders");

  let supabase: Awaited<ReturnType<typeof createReadOnlyClient>>;
  try {
    supabase = await createReadOnlyClient();
  } catch (error) {
    console.error("Supabase is not configured for order confirmation:", error);
    return (
      <StorefrontLayout active="profile">
        <PageHeading eyebrow="Order status" title="Order status unavailable" description="We couldn't verify your order with the store right now." />
        <section className="sb-checkout-notice" role="alert"><p>Check your connection and return to your account or contact support before placing another order.</p><Link className="sb-button sb-button-outline" href="/account">My account</Link></section>
      </StorefrontLayout>
    );
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) console.error("Could not verify order confirmation session:", authError.message);
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(`/order-confirmation?ref=${ref}`)}`);

  const { data: rawOrder, error: orderError } = await supabase
    .from("orders")
    .select("id,order_number,status,payment_status,payment_method,subtotal_inr,discount_inr,shipping_inr,tax_inr,total_inr,created_at")
    .eq("order_number", ref)
    .maybeSingle();
  if (orderError) console.error("Could not load order confirmation:", orderError.message);
  const order = rawOrder as OrderRow | null;
  const { data: items, error: itemsError } = order
    ? await supabase.from("order_items")
        .select("product_name,variant_name,sku,quantity,unit_price_inr,line_total_inr")
        .eq("order_id", order.id)
    : { data: [], error: null };
  if (itemsError) console.error("Could not load order items:", itemsError.message);

  const orderConfirmed = order?.status === "confirmed" || ["processing", "shipped", "delivered"].includes(order?.status ?? "");
  const paymentPending = order?.payment_status === "pending";

  return (
    <StorefrontLayout active="profile">
      <PageHeading
        eyebrow={order ? `Order ${order.order_number}` : "Order status"}
        title={!order ? "We couldn't find that order" : orderConfirmed ? "Thank you for your order" : paymentPending ? "Payment verification pending" : "Order status"}
        description={!order ? "This order reference is not available in your account." : orderConfirmed ? "Your order has been recorded with Sachin Brands." : paymentPending ? "The payment provider has not confirmed your payment yet. Do not pay again while we verify the order." : "Your order has a current status shown below."}
      />
      {!order ? (
        <section className="sb-checkout-notice" role="alert">
          <span className="sb-empty-icon"><Icon name="shield" size={25} /></span>
          <h2>No matching order</h2>
          <p>Only orders belonging to your signed-in account can be shown here. No new order was created by opening this page.</p>
          <Link className="sb-button sb-button-outline" href="/orders">View my orders</Link>
        </section>
      ) : (
        <section className="sb-order-confirmation">
          <div className={`sb-order-confirmation-status${orderConfirmed ? " is-confirmed" : ""}`}>
            <span><Icon name={orderConfirmed ? "check" : "shield"} size={25} /></span>
            <div>
              <strong>{orderConfirmed ? "Order confirmed" : paymentPending ? "Awaiting verified payment" : `Order ${order.status.replace(/_/g, " ")}`}</strong>
              <p>Reference <b>{order.order_number}</b> · {new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
            </div>
          </div>
          {itemsError && <p className="sb-checkout-alert" role="alert">Order items could not be loaded. Your order record remains available in My Orders.</p>}
          <div className="sb-confirmation-items">
            {(items ?? []).map((item) => (
              <div key={`${item.sku}-${item.variant_name}`}>
                <span><strong>{item.product_name}</strong><small>{item.variant_name} · SKU {item.sku} · Qty {item.quantity}</small></span>
                <b>{formatPrice(Number(item.line_total_inr))}</b>
              </div>
            ))}
          </div>
          <dl className="sb-confirmation-totals">
            <div><dt>Subtotal</dt><dd>{formatPrice(Number(order.subtotal_inr))}</dd></div>
            <div><dt>Discount</dt><dd>−{formatPrice(Number(order.discount_inr))}</dd></div>
            <div><dt>Shipping</dt><dd>{Number(order.shipping_inr) === 0 ? "Free" : formatPrice(Number(order.shipping_inr))}</dd></div>
            <div><dt>Tax</dt><dd>{formatPrice(Number(order.tax_inr))}</dd></div>
            <div className="is-total"><dt>Total payable</dt><dd>{formatPrice(Number(order.total_inr))}</dd></div>
          </dl>
          <p className="sb-order-payment-note">
            {order.payment_method === "cod"
              ? "Payment is due on delivery."
              : order.payment_status === "paid"
                ? "Razorpay confirmed your payment."
                : "Payment status: pending. The order will be confirmed only after a verified Razorpay payment event."}
          </p>
          <div className="sb-checkout-actions">
            <Link className="sb-button sb-button-primary" href="/products">Continue shopping <Icon name="arrow" size={17} /></Link>
            <Link className="sb-button sb-button-outline" href={`/orders/${encodeURIComponent(order.order_number)}`}>Track this order</Link>
          </div>
        </section>
      )}
    </StorefrontLayout>
  );
}
