import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { isSameOriginRequest } from "@/utils/same-origin";

export const runtime = "nodejs";

const requestSchema = z.object({
  addressId: z.string().uuid(),
  checkoutKey: z.string().uuid(),
  paymentMethod: z.enum(["cod", "razorpay"]),
  items: z.array(z.object({
    variant_id: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
  })).min(1).max(40),
  couponCode: z.string().trim().max(40).optional().default(""),
});

function publicError(message: string) {
  if (/Authentication required/i.test(message)) return "Please sign in to place your order.";
  if (/stock|available|cart is empty|invalid cart/i.test(message)) return "An item in your cart is unavailable or its quantity has changed. Please review your cart.";
  if (/coupon/i.test(message)) return message;
  if (/awaiting confirmation/i.test(message)) return "An online payment is already awaiting confirmation. Check its order status before placing another order.";
  if (/address/i.test(message)) return message;
  if (/Cash on Delivery|Online payment/i.test(message)) return message;
  return "We couldn't place your order. Please check your details and try again.";
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 65536) {
    return NextResponse.json({ error: "Checkout request is too large." }, { status: 413 });
  }
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: "Checkout details are invalid. Review your address and cart." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Please sign in to place your order." }, { status: 401 });
  }

  const { data: config, error: configError } = await supabase.rpc("get_checkout_config");
  if (configError) {
    console.error("Could not load checkout configuration:", configError.message);
    return NextResponse.json({ error: "Checkout is not configured yet. Apply the commerce migration and configure store settings." }, { status: 503 });
  }
  const settings = config && typeof config === "object"
    ? config as Record<string, unknown>
    : {};
  if (parsed.data.paymentMethod === "cod" && settings.cod_enabled !== true) {
    return NextResponse.json({ error: "Cash on Delivery is not currently available." }, { status: 409 });
  }
  if (parsed.data.paymentMethod === "razorpay" && settings.razorpay_enabled !== true) {
    return NextResponse.json({ error: "Online payment is not currently available." }, { status: 409 });
  }

  const isRazorpayConfigured =
    parsed.data.paymentMethod !== "razorpay" ||
    (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  if (!isRazorpayConfigured) {
    return NextResponse.json({ error: "Online payment is not configured. Choose Cash on Delivery if it is available." }, { status: 503 });
  }

  const { data: order, error: orderError } = await supabase.rpc("place_checkout_order", {
    p_address_id: parsed.data.addressId,
    p_checkout_key: parsed.data.checkoutKey,
    p_payment_method: parsed.data.paymentMethod,
    p_items: parsed.data.items,
    p_coupon_code: parsed.data.couponCode || null,
  });
  if (orderError || !order || typeof order !== "object") {
    if (orderError) console.error("Transactional order placement failed:", orderError.message);
    return NextResponse.json({
      error: publicError(orderError?.message ?? ""),
    }, { status: orderError ? 400 : 500 });
  }

  const orderDetails = order as Record<string, unknown>;
  if (parsed.data.paymentMethod === "cod") {
    return NextResponse.json({ order: orderDetails });
  }

  const orderId = typeof orderDetails.id === "string" ? orderDetails.id : "";
  const orderNumber = typeof orderDetails.order_number === "string" ? orderDetails.order_number : "";
  const amount = Number(orderDetails.total_inr);
  if (orderDetails.status !== "pending_payment") {
    return NextResponse.json({ error: "This online order is no longer awaiting payment. Check its current order status." }, { status: 409 });
  }
  if (!orderId || !orderNumber || !Number.isFinite(amount) || amount <= 0) {
    console.error("Checkout database function returned an invalid online order payload.");
    return NextResponse.json({ error: "The order could not be prepared for online payment." }, { status: 500 });
  }

  try {
    const { data: existingPayment, error: paymentLookupError } = await supabase
      .from("payments")
      .select("razorpay_order_id,status")
      .eq("order_id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (paymentLookupError) throw paymentLookupError;
    if (existingPayment?.razorpay_order_id && existingPayment.status === "pending") {
      return NextResponse.json({
        order: orderDetails,
        razorpay: {
          keyId: process.env.RAZORPAY_KEY_ID,
          orderId: existingPayment.razorpay_order_id,
          amount: Math.round(amount * 100),
          currency: "INR",
          name: "Sachin Brands",
          description: `Order ${orderNumber}`,
          prefill: { name: user.user_metadata.full_name ?? "", email: user.email ?? "" },
        },
      });
    }

    const razorpayResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: "INR",
        receipt: orderNumber,
        notes: { sb_order_id: orderId },
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    const paymentOrder: unknown = await razorpayResponse.json();
    if (!razorpayResponse.ok || !paymentOrder || typeof paymentOrder !== "object") {
      throw new Error(`Razorpay order creation returned HTTP ${razorpayResponse.status}.`);
    }
    const providerOrder = paymentOrder as Record<string, unknown>;
    const providerOrderId = providerOrder.id;
    if (
      typeof providerOrderId !== "string" ||
      !providerOrderId ||
      providerOrder.amount !== Math.round(amount * 100) ||
      providerOrder.currency !== "INR" ||
      providerOrder.receipt !== orderNumber
    ) {
      throw new Error("Razorpay response did not match the requested order amount and reference.");
    }

    const { error: attachError } = await supabase.rpc("attach_razorpay_order", {
      p_order_id: orderId,
      p_razorpay_order_id: providerOrderId,
    });
    if (attachError) throw attachError;

    return NextResponse.json({
      order: orderDetails,
      razorpay: {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: providerOrderId,
        amount: Math.round(amount * 100),
        currency: "INR",
        name: "Sachin Brands",
        description: `Order ${orderNumber}`,
        prefill: { name: user.user_metadata.full_name ?? "", email: user.email ?? "" },
      },
    });
  } catch (error) {
    console.error("Could not create Razorpay checkout order:", error);
    const { error: cancelError } = await supabase.rpc("cancel_pending_checkout", {
      p_order_id: orderId,
    });
    if (cancelError) {
      console.error("Could not release reserved inventory after payment setup failed:", cancelError.message);
      return NextResponse.json({ error: "Payment setup failed and the reserved order needs support review. Please contact support before retrying." }, { status: 502 });
    }
    return NextResponse.json({ error: "Razorpay could not prepare this payment. Your order was cancelled and inventory released." }, { status: 502 });
  }
}
