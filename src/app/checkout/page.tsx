import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeading } from "@/components/storefront/page-heading";
import { StorefrontLayout } from "@/components/storefront/storefront-layout";
import { createReadOnlyClient } from "@/utils/supabase/server";
import { isRazorpayConfigured } from "@/utils/razorpay-config";
import CheckoutForm, { type CheckoutAddress } from "./checkout-form";

export const metadata: Metadata = {
  title: "Secure checkout",
  description: "Review your Sachin Brands cart and place your order securely.",
};

export const dynamic = "force-dynamic";

type CheckoutConfig = {
  cod_enabled: boolean;
  razorpay_enabled: boolean;
  shipping_fee_inr: number;
  free_shipping_threshold_inr: number | null;
  tax_rate_percent: number;
};

export default async function CheckoutPage() {
  let supabase: Awaited<ReturnType<typeof createReadOnlyClient>>;
  try {
    supabase = await createReadOnlyClient();
  } catch (error) {
    console.error("Supabase is not configured for checkout:", error);
    return (
      <StorefrontLayout active="cart">
        <PageHeading eyebrow="Almost there" title="Secure checkout" description="Complete your order using a real, server-validated checkout." />
        <section className="sb-checkout-notice" role="alert">
          <h2>Supabase setup required</h2>
          <p>Configure the public Supabase URL and publishable key, then apply the commerce migration before placing an order.</p>
        </section>
      </StorefrontLayout>
    );
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError") {
    console.error("Could not verify checkout session:", authError.message);
  }
  if (!user?.email) redirect("/login?callbackUrl=%2Fcheckout");

  const [addressResult, configResult] = await Promise.all([
    supabase.from("addresses")
      .select("id,recipient_name,phone,line1,line2,city,state,pin_code,is_default")
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase.rpc("get_checkout_config"),
  ]);
  const setupErrors = [
    addressResult.error ? "Shipping addresses are unavailable. Apply the commerce migration and check its RLS policies." : null,
    configResult.error ? "Checkout settings are unavailable. Apply the commerce migration and configure store settings." : null,
  ].filter((message): message is string => Boolean(message));
  if (addressResult.error) console.error("Could not load customer addresses:", addressResult.error.message);
  if (configResult.error) console.error("Could not load checkout settings:", configResult.error.message);

  const addresses: CheckoutAddress[] = (addressResult.data ?? []).map((address) => ({
    id: address.id,
    recipientName: address.recipient_name,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    pinCode: address.pin_code,
    isDefault: address.is_default,
  }));
  const rawConfig = configResult.data && typeof configResult.data === "object"
    ? configResult.data as Record<string, unknown>
    : {};
  const config: CheckoutConfig = {
    cod_enabled: rawConfig.cod_enabled === true,
    razorpay_enabled:
      rawConfig.razorpay_enabled === true &&
      isRazorpayConfigured(),
    shipping_fee_inr: Number(rawConfig.shipping_fee_inr ?? 0),
    free_shipping_threshold_inr:
      rawConfig.free_shipping_threshold_inr === null || rawConfig.free_shipping_threshold_inr === undefined
        ? null
        : Number(rawConfig.free_shipping_threshold_inr),
    tax_rate_percent: Number(rawConfig.tax_rate_percent ?? 0),
  };

  return (
    <StorefrontLayout active="cart">
      <PageHeading
        eyebrow="Almost there"
        title="Secure checkout"
        description="Your prices, inventory, discount and final payable amount are revalidated by Supabase when you place the order."
      />
      <CheckoutForm
        accountEmail={user.email}
        initialAddresses={addresses}
        config={config}
        setupErrors={setupErrors}
      />
    </StorefrontLayout>
  );
}
