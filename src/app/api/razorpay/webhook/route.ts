import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type RazorpayWebhookPayload = {
  event?: unknown;
  payload?: {
    payment?: {
      entity?: {
        order_id?: unknown;
        id?: unknown;
        amount?: unknown;
        currency?: unknown;
        captured?: unknown;
      };
    };
  };
};

export async function POST(request: Request) {
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!webhookSecret || !serviceRoleKey || !supabaseUrl) {
    console.error("Razorpay webhook is not configured with its signing secret and server-only Supabase key.");
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest();
  const received = Buffer.from(signature, "hex");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  }

  let event: RazorpayWebhookPayload;
  try {
    event = JSON.parse(rawBody) as RazorpayWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  const payment = event.payload?.payment?.entity;
  const providerOrderId = payment?.order_id;
  const providerPaymentId = payment?.id;
  if (event.event !== "payment.captured") {
    return NextResponse.json({ received: true });
  }
  if (
    typeof providerOrderId !== "string" ||
    !providerOrderId ||
    typeof providerPaymentId !== "string" ||
    !providerPaymentId ||
    typeof payment?.amount !== "number" ||
    !Number.isSafeInteger(payment.amount) ||
    payment.currency !== "INR" ||
    payment.captured !== true
  ) {
    return NextResponse.json({ error: "Captured payment event is incomplete." }, { status: 400 });
  }

  const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error } = await supabase.rpc("confirm_razorpay_webhook", {
    p_razorpay_order_id: providerOrderId,
    p_provider_payment_id: providerPaymentId,
    p_amount_paise: payment.amount,
    p_currency: payment.currency,
  });
  if (error) {
    console.error("Could not process Razorpay payment.captured webhook:", error.message);
    return NextResponse.json({ error: "Payment event could not be processed." }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
