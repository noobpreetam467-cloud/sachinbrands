import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { isSameOriginRequest } from "@/utils/same-origin";

export const runtime = "nodejs";

const verifySchema = z.object({
  orderId: z.string().uuid(),
  razorpay_order_id: z.string().min(1).max(100),
  razorpay_payment_id: z.string().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f0-9]{64}$/i),
});

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16384) {
    return NextResponse.json({ error: "Payment verification request is too large." }, { status: 413 });
  }
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payment verification request." }, { status: 400 });
  }
  const parsed = verifySchema.safeParse(rawBody);
  if (!parsed.success) return NextResponse.json({ error: "Payment verification details are invalid." }, { status: 400 });
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!secret || !keyId) return NextResponse.json({ error: "Online payment verification is not configured." }, { status: 503 });

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in to verify your payment." }, { status: 401 });

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("order_id,razorpay_order_id,status,amount_inr,provider_payment_id")
    .eq("order_id", parsed.data.orderId)
    .eq("user_id", user.id)
    .eq("method", "razorpay")
    .maybeSingle();
  if (paymentError || !payment || payment.razorpay_order_id !== parsed.data.razorpay_order_id) {
    if (paymentError) console.error("Could not verify the pending payment record:", paymentError.message);
    return NextResponse.json({ error: "This payment does not match a pending Sachin Brands order." }, { status: 409 });
  }

  const expected = createHmac("sha256", secret)
    .update(`${parsed.data.razorpay_order_id}|${parsed.data.razorpay_payment_id}`)
    .digest();
  const received = Buffer.from(parsed.data.razorpay_signature, "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return NextResponse.json({ error: "Razorpay could not verify this payment signature." }, { status: 400 });
  }

  if (payment.status === "paid" && payment.provider_payment_id === parsed.data.razorpay_payment_id) {
    return NextResponse.json({ verified: true });
  }
  if (payment.status !== "pending") {
    return NextResponse.json({ error: "This payment is no longer pending." }, { status: 409 });
  }

  let providerPayment: unknown;
  try {
    const providerResponse = await fetch(
      `https://api.razorpay.com/v1/payments/${encodeURIComponent(parsed.data.razorpay_payment_id)}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!providerResponse.ok) {
      console.error("Razorpay payment lookup failed with status:", providerResponse.status);
      return NextResponse.json({ error: "Razorpay has not confirmed this payment yet. Do not pay again; check the order status shortly." }, { status: 503 });
    }
    providerPayment = await providerResponse.json();
  } catch (error) {
    console.error("Could not confirm captured Razorpay payment with the provider:", error);
    return NextResponse.json({ error: "Razorpay payment status could not be checked. Do not pay again; check the order status shortly." }, { status: 503 });
  }
  const providerDetails = providerPayment && typeof providerPayment === "object"
    ? providerPayment as Record<string, unknown>
    : {};
  if (
    providerDetails.order_id !== parsed.data.razorpay_order_id ||
    providerDetails.currency !== "INR" ||
    providerDetails.amount !== Math.round(Number(payment.amount_inr) * 100)
  ) {
    console.error("Razorpay payment amount or order reference did not match the pending store order.");
    return NextResponse.json({ error: "Razorpay payment details do not match this order." }, { status: 409 });
  }
  if (providerDetails.status !== "captured") {
    return NextResponse.json({ error: "Razorpay has not captured this payment yet. Do not pay again; check the order status shortly." }, { status: 409 });
  }

  const { error: confirmError } = await supabase.rpc("confirm_razorpay_payment", {
    p_order_id: parsed.data.orderId,
    p_provider_payment_id: parsed.data.razorpay_payment_id,
  });
  if (confirmError) {
    console.error("Razorpay signature was valid but order confirmation failed:", confirmError.message);
    return NextResponse.json({ error: "Payment was received but order confirmation is still processing. Do not pay again; refresh your orders shortly." }, { status: 503 });
  }

  return NextResponse.json({ verified: true });
}
