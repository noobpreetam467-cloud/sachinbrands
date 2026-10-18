import Link from "next/link";
import { PageHeading } from "./page-heading";
import { StorefrontLayout } from "./storefront-layout";
import { Icon } from "./icon";
import { getStorefrontContent } from "@/data/storefront-content";

export function AboutPage() {
  return (
    <StorefrontLayout>
      <PageHeading eyebrow="Our point of view" title="Technology, with a little more thought." description="Sachin Brands is being shaped around a simple idea: choosing good technology should feel clear, considered, and human." />
      <section className="sb-story-panel"><span className="sb-story-icon"><Icon name="spark" size={26} /></span><h2>Less noise. Better choices.</h2><p>We&apos;re building a destination for smartphones, gadgets, audio, and everyday accessories. Published product names, prices, images, specifications, and availability are loaded from the Sachin Brands Supabase catalog.</p><p>Checkout is available only when the store has configured its payment and delivery settings. Order prices, inventory and payment status are revalidated by the server.</p><Link className="sb-button sb-button-primary" href="/products">Explore products <Icon name="arrow" size={18} /></Link></section>
    </StorefrontLayout>
  );
}

export async function ContactPage() {
  const store = await getStorefrontContent();
  return (
    <StorefrontLayout>
      <PageHeading eyebrow="We’re listening" title="Let’s talk." description="Reach the Sachin Brands support team using the contact details configured by the store." />
      <section className="sb-story-panel"><span className="sb-story-icon"><Icon name="mail" size={26} /></span><h2>Get in touch</h2>
        {store?.support_email ? <p>Email <a href={`mailto:${store.support_email}`}>{store.support_email}</a></p> : <p>Customer support email has not been configured yet.</p>}
        {store?.support_phone ? <p>Call <a href={`tel:${store.support_phone}`}>{store.support_phone}</a></p> : <p>Customer support phone has not been configured yet.</p>}
      </section>
    </StorefrontLayout>
  );
}

const policyCopy = {
  shipping: {
    title: "Shipping information",
    eyebrow: "Delivery",
    description: "Shipping charges are calculated from the current store settings at checkout.",
    body: "Delivery fees and any free-shipping threshold are shown in the checkout order summary. Delivery timelines and carrier details are provided when an order is shipped.",
  },
  returns: {
    title: "Returns & refunds",
    eyebrow: "Support",
    description: "Return requests are subject to the published store policy and the order's delivery status.",
    body: "A return request is reviewed by the store and does not itself issue a refund. Refunds are processed only through a verified payment-provider or store operation.",
  },
  privacy: {
    title: "Privacy",
    eyebrow: "Your information",
    description: "Supabase Auth and the store database process the account and order data needed to provide customer services.",
    body: "Signed-in accounts may store profile details, saved addresses, carts, wishlists, orders, return requests and notifications. Payment credentials are handled by the configured payment provider and are not stored in customer profile fields. Contact the store for information about retention and privacy requests.",
  },
  terms: {
    title: "Terms of use",
    eyebrow: "The details",
    description: "Products and checkout availability are provided by the store's current catalog and settings.",
    body: "Order prices, stock, coupon eligibility and totals are confirmed by the server at checkout. An order is not paid until the configured payment flow confirms payment. Store-specific shipping, returns and payment terms should be reviewed before placing an order.",
  },
} as const;

export async function PolicyPage({ page }: { page: keyof typeof policyCopy }) {
  const store = await getStorefrontContent();
  const copy = policyCopy[page];
  const configuredBody = page === "shipping"
    ? store?.shipping_policy
    : page === "returns" ? store?.return_policy : "";
  const configured = Boolean(configuredBody?.trim());
  const description = page === "returns" && configured
    ? `Return requests are assessed within ${store?.return_window_days ?? 30} days of delivery.`
    : copy.description;
  return (
    <StorefrontLayout>
      <PageHeading eyebrow={copy.eyebrow} title={copy.title} description={description} />
      <section className="sb-story-panel"><span className="sb-story-icon"><Icon name="shield" size={26} /></span><h2>{configured ? "Store policy" : "Policy information"}</h2><p className={configured ? "sb-policy-copy" : undefined}>{configured ? configuredBody : copy.body}</p><p>For questions, <Link href="/contact">contact Sachin Brands</Link>.</p></section>
    </StorefrontLayout>
  );
}
