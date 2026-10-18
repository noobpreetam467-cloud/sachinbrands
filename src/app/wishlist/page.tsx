import type { Metadata } from "next";
import { WishlistPage } from "@/components/storefront/wishlist-page";
import { StorefrontLayout } from "@/components/storefront/storefront-layout";

export const metadata: Metadata = { title: "Wishlist" };

export default function Page() {
  return <StorefrontLayout active="wishlist"><WishlistPage /></StorefrontLayout>;
}
