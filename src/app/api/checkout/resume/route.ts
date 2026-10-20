import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { isSameOriginRequest } from "@/utils/same-origin";
import { isRazorpayConfigured } from "@/utils/razorpay-config";

export const runtime = "nodejs";

const resumeSchema = z.object({ orderId: z.string().uuid() });

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 8192) {
    return NextResponse.json({ error: "Payment resume request is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payment resume request." }, { status: 400 });
  }
  const parsed = resumeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Order reference is invalid." }, { status: 400 });
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "Razorpay is not configured to resume this payment." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in to resume payment." }, { status: 401 });

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,order_number,status,payment_status,payment_method,total_inr")
    .eq("id", parsed.data.orderId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (orderError) {
    console.error("Could not load order for payment resumption:", orderError.message);
    return NextResponse.json({ error: "Order status is unavailable. Please try again." }, { status: 503 });
  }
  if (!order || order.status !== "pending_payment" || order.payment_method !== "razorpay") {
    return NextResponse.json({ error: "This order is not awaiting an online payment." }, { status: 409 });
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("razorpay_order_id,status")
    .eq("order_id", order.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (paymentError) {
    console.error("Could not load payment for resumption:", paymentError.message);
    return NextResponse.json({ error: "Payment status is unavailable. Please try again." }, { status: 503 });
  }
  if (!payment || payment.status !== "pending" || !payment.razorpay_order_id) {
    return NextResponse.json({ error: "This order has no resumable Razorpay payment session." }, { status: 409 });
  }

  return NextResponse.json({
    order: { id: order.id, order_number: order.order_number },
    razorpay: {
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: payment.razorpay_order_id,
      amount: Math.round(Number(order.total_inr) * 100),
      currency: "INR",
      name: "Sachin Brands",
      description: `Order ${order.order_number}`,
      prefill: {
        name: typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name : "",
        email: user.email ?? "",
      },
    },
  });
}
