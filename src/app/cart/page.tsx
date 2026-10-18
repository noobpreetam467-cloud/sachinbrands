import type { Metadata } from "next";
import { CartPage } from "@/components/storefront/cart-page";
import { StorefrontLayout } from "@/components/storefront/storefront-layout";

export const metadata: Metadata = { title: "Shopping cart" };

export default function Page() {
  return <StorefrontLayout active="cart"><CartPage /></StorefrontLayout>;
}
