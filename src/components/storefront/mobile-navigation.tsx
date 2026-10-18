"use client";

import Link from "next/link";
import { useStorefront } from "./storefront-provider";
import type { IconName } from "./icon";
import { Icon } from "./icon";

const tabs: { id: "home" | "categories" | "wishlist" | "cart" | "profile"; label: string; href: string; icon: IconName }[] = [
  { id: "home", label: "Home", href: "/", icon: "laptop" },
  { id: "categories", label: "Categories", href: "/categories", icon: "menu" },
  { id: "wishlist", label: "Wishlist", href: "/wishlist", icon: "heart" },
  { id: "cart", label: "Cart", href: "/cart", icon: "cart" },
  { id: "profile", label: "Profile", href: "/account", icon: "user" },
];

export function MobileNavigation({ active }: { active: (typeof tabs)[number]["id"] }) {
  const { cart } = useStorefront();
  const cartCount = Object.values(cart).reduce((total, count) => total + count, 0);

  return (
    <nav aria-label="Mobile navigation" className="sb-mobile-nav">
      {tabs.map((tab) => (
        <Link
          aria-current={active === tab.id ? "page" : undefined}
          className={`sb-mobile-tab${active === tab.id ? " is-active" : ""}`}
          href={tab.href}
          key={tab.id}
        >
          <span className="sb-mobile-icon">
            <Icon name={tab.icon} size={21} />
            {tab.id === "cart" && cartCount > 0 && <span className="sb-mobile-count">{cartCount}</span>}
          </span>
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
