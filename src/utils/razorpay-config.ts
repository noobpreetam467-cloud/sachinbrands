export function isRazorpayConfigured() {
  return Boolean(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_WEBHOOK_SECRET &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}
