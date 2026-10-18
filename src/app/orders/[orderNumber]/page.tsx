import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatPrice } from "@/data/catalog-types";
import { Icon } from "@/components/storefront/icon";
import { PageHeading } from "@/components/storefront/page-heading";
import { StorefrontLayout } from "@/components/storefront/storefront-layout";
import { cancelCodOrder, requestReturn, submitProductReview } from "@/app/account/actions";
import { createReadOnlyClient } from "@/utils/supabase/server";

export const metadata: Metadata = { title: "Order tracking" };

export const dynamic = "force-dynamic";

type AddressSnapshot = {
  recipient_name?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  pin_code?: string;
};
function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : null;
}

function safeTrackingUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams: Promise<{ error?: string; updated?: string }>;
}) {
  const { orderNumber } = await params;
  const query = await searchParams;
  if (!/^SB-[A-Z0-9-]{5,40}$/i.test(orderNumber)) notFound();

  let supabase: Awaited<ReturnType<typeof createReadOnlyClient>>;
  try {
    supabase = await createReadOnlyClient();
  } catch (error) {
    console.error("Supabase order tracking is unavailable:", error);
    return <StorefrontLayout active="profile"><PageHeading eyebrow="Your account" title="Order tracking unavailable" description="We couldn't connect to the order service." /><div className="sb-empty-page" role="alert"><p>Check Supabase configuration and try again.</p></div></StorefrontLayout>;
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) console.error("Could not verify order detail session:", authError.message);
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(`/orders/${orderNumber}`)}`);
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,order_number,status,payment_status,payment_method,address_snapshot,subtotal_inr,discount_inr,shipping_inr,tax_inr,total_inr,created_at,confirmed_at,processing_at,shipped_at,delivered_at,cancelled_at,carrier,tracking_number,tracking_url")
    .eq("order_number", orderNumber)
    .maybeSingle();
  if (orderError) {
    console.error("Could not read customer order details:", orderError.message);
    return <StorefrontLayout active="profile"><PageHeading eyebrow="Your account" title="Order details unavailable" description="We couldn't load this order right now." /><div className="sb-empty-page" role="alert"><p>Please refresh or contact customer support.</p></div></StorefrontLayout>;
  }
  if (!order) notFound();

  const [
    { data: items, error: itemsError },
    { data: returnRequest, error: returnError },
    { data: statusEvents, error: statusEventsError },
    { data: storefrontContent, error: storefrontError },
  ] = await Promise.all([
    supabase.from("order_items").select("product_id,product_name,variant_name,sku,quantity,unit_price_inr,line_total_inr").eq("order_id", order.id),
    supabase.from("return_requests").select("id,status,reason,created_at").eq("order_id", order.id).maybeSingle(),
    supabase.from("order_status_events").select("status,created_at").eq("order_id", order.id).order("created_at", { ascending: true }),
    supabase.from("storefront_content").select("return_window_days").eq("id", true).maybeSingle(),
  ]);
  if (itemsError) console.error("Could not read ordered items:", itemsError.message);
  if (returnError) console.error("Could not read return request status:", returnError.message);
  if (statusEventsError) console.error("Could not read order status timeline:", statusEventsError.message);
  if (storefrontError) console.error("Could not read the configured return window:", storefrontError.message);
  const { data: canRequestReturn, error: returnEligibilityError } = await supabase.rpc(
    "can_request_customer_return",
    { p_order_id: order.id },
  );
  if (returnEligibilityError) console.error("Could not check return eligibility:", returnEligibilityError.message);
  const orderItems = items ?? [];
  const address = order.address_snapshot as AddressSnapshot;
  const currentStatus = order.status;
  const onlinePending = currentStatus === "pending_payment";
  const cancellableCod = currentStatus === "confirmed" && order.payment_method === "cod" && order.payment_status === "due_on_delivery";
  const returnEligible = canRequestReturn === true && !returnRequest;
  const returnWindowDays = storefrontContent?.return_window_days ?? 30;
  const trackingUrl = safeTrackingUrl(order.tracking_url);
  const productIds = orderItems.map((item) => item.product_id);
  const { data: reviews, error: reviewsError } = productIds.length
    ? await supabase.from("reviews").select("product_id,status").in("product_id", productIds).eq("user_id", user.id)
    : { data: [], error: null };
  if (reviewsError) console.error("Could not read your reviews:", reviewsError.message);
  const reviewedProducts = new Set((reviews ?? []).map((review) => review.product_id));
  const canReview = currentStatus === "delivered";

  return (
    <StorefrontLayout active="profile">
      <PageHeading eyebrow={`Order ${order.order_number}`} title="Order tracking" description="Order, payment and delivery details from your account." />
      {query.error === "cancel" && <p className="profile-form-message is-error" role="alert">This order is not eligible for online cancellation. If it has been paid, contact support to request help.</p>}
      {query.error === "return" && <p className="profile-form-message is-error" role="alert">We couldn&apos;t submit that return request. Check the {returnWindowDays}-day eligibility window and request status.</p>}
      {query.error === "review" && <p className="profile-form-message is-error" role="alert">Review could not be submitted. The item must be purchased on this account and only one review per product is accepted.</p>}
      {returnEligibilityError && <p className="profile-form-message is-error" role="alert">Return eligibility could not be verified. Apply the customer account migration or try again later.</p>}
      {query.updated === "cancelled" && <p className="profile-form-message" role="status">Your Cash on Delivery order was cancelled.</p>}
      {query.updated === "return" && <p className="profile-form-message" role="status">Your return request was submitted for store review. No refund has been issued.</p>}
      {query.updated === "review" && <p className="profile-form-message" role="status">Your review was submitted for moderation.</p>}

      <div className="sb-account-order-detail">
        <section className="sb-order-detail-card">
          <div className="sb-order-detail-heading"><div><span className="sb-eyebrow">{new Date(order.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span><h2>{order.order_number}</h2></div><span className={`sb-order-status${["confirmed", "processing", "shipped", "delivered"].includes(currentStatus) ? " is-confirmed" : ""}`}>{currentStatus.replace(/_/g, " ")}</span></div>
          <h3>Order progress</h3>
          {statusEventsError ? <p className="sb-checkout-alert" role="alert">Order status history could not be loaded.</p> : statusEvents?.length ? <ol className="sb-order-timeline">
            {statusEvents.map((event, index) => <li className={index === statusEvents.length - 1 ? "is-current" : "is-complete"} key={`${event.status}-${event.created_at}`}><span /><div><strong>{event.status === "pending_payment" ? "Placed — awaiting payment" : event.status.replace(/_/g, " ")}</strong><time>{formatDate(event.created_at)}</time></div></li>)}
          </ol> : <p className="sb-checkout-notice">Current status: {currentStatus.replace(/_/g, " ")}. Detailed status history is available for orders placed after the customer tracking migration.</p>}
          {onlinePending && <p className="sb-order-payment-note">Payment status: {order.payment_status.replace(/_/g, " ")}. The order is not confirmed until payment verification completes.</p>}
          {order.status === "shipped" || order.status === "delivered" ? <div className="sb-tracking-panel"><h3>Delivery tracking</h3>{order.carrier && <p>Carrier: <strong>{order.carrier}</strong></p>}{order.tracking_number && <p>Tracking number: <strong>{order.tracking_number}</strong></p>}{trackingUrl && <a className="sb-button sb-button-outline" href={trackingUrl} rel="noopener noreferrer" target="_blank">Track with carrier <Icon name="arrow" size={16} /></a>}{!order.carrier && !order.tracking_number && <p>Tracking details have not been added yet.</p>}</div> : null}
          <div className="sb-order-detail-actions">
            {cancellableCod && <form action={cancelCodOrder}><input name="orderId" type="hidden" value={order.id} /><input name="orderNumber" type="hidden" value={order.order_number} /><button className="sb-button sb-button-outline" type="submit">Cancel COD order</button></form>}
            {returnEligible && <form action={requestReturn} className="sb-return-request-form"><h3>Request a return</h3><p>Available within {returnWindowDays} days after delivery. This submits a request only; it does not issue a refund.</p><input name="orderId" type="hidden" value={order.id} /><input name="orderNumber" type="hidden" value={order.order_number} /><label htmlFor="return-reason">Reason</label><textarea id="return-reason" maxLength={1000} minLength={10} name="reason" required rows={4} /><button className="sb-button sb-button-primary" type="submit">Submit return request</button></form>}
            {returnRequest && <div className="sb-return-request-status"><strong>Return request: {returnRequest.status}</strong><p>{returnRequest.reason}</p><small>No refund is issued by this status.</small></div>}
          </div>
        </section>
        <aside className="sb-order-detail-sidebar">
          <section className="sb-order-detail-card"><h2>Delivery address</h2><address><strong>{address.recipient_name}</strong><span>{address.phone}</span><span>{address.line1}{address.line2 ? `, ${address.line2}` : ""}</span><span>{address.city}, {address.state} {address.pin_code}</span></address></section>
          <section className="sb-order-detail-card"><h2>Payment</h2><p>{order.payment_method === "cod" ? "Cash on Delivery" : "Razorpay"}</p><span className="sb-order-status">{order.payment_status.replace(/_/g, " ")}</span><dl className="sb-confirmation-totals"><div><dt>Subtotal</dt><dd>{formatPrice(Number(order.subtotal_inr))}</dd></div><div><dt>Discount</dt><dd>−{formatPrice(Number(order.discount_inr))}</dd></div><div><dt>Shipping</dt><dd>{Number(order.shipping_inr) === 0 ? "Free" : formatPrice(Number(order.shipping_inr))}</dd></div><div><dt>Tax</dt><dd>{formatPrice(Number(order.tax_inr))}</dd></div><div className="is-total"><dt>Total</dt><dd>{formatPrice(Number(order.total_inr))}</dd></div></dl></section>
        </aside>
        <section className="sb-order-detail-card sb-order-items-card"><h2>Purchased items</h2>{itemsError ? <p role="alert">Purchased item details could not be loaded.</p> : orderItems.map((item) => <article className="sb-order-item" key={`${item.product_id}-${item.sku}`}><div><strong>{item.product_name}</strong><span>{item.variant_name} · SKU {item.sku} · Qty {item.quantity}</span><small>{formatPrice(Number(item.unit_price_inr))} each</small></div><b>{formatPrice(Number(item.line_total_inr))}</b>{canReview && !reviewedProducts.has(item.product_id) && <form action={submitProductReview} className="sb-review-form"><h3>Review this product</h3><input name="productId" type="hidden" value={item.product_id} /><input name="orderNumber" type="hidden" value={order.order_number} /><label>Rating<select aria-label={`Rating for ${item.product_name}`} defaultValue="5" name="rating"><option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Okay</option><option value="2">2 - Poor</option><option value="1">1 - Very poor</option></select></label><label>Title (optional)<input maxLength={120} name="title" /></label><label>Review (optional)<textarea maxLength={2000} name="body" rows={3} /></label><button className="sb-button sb-button-outline" type="submit">Submit review</button></form>}{reviewedProducts.has(item.product_id) && <p className="sb-review-pending">You have already reviewed this product. Pending reviews are moderated before publication.</p>}</article>)}</section>
      </div>
      <div className="sb-checkout-actions"><Link className="sb-button sb-button-outline" href="/orders">Back to my orders</Link><Link className="sb-button sb-button-primary" href="/account">My account</Link></div>
    </StorefrontLayout>
  );
}
