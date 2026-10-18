"use client";

import Link from "next/link";
import { useStorefront } from "./storefront-provider";
import { Icon } from "./icon";

export function StorefrontHeaderActions() {
  const { cart, wishlist } = useStorefront();
  const cartCount = Object.values(cart).reduce((total, count) => total + count, 0);

  return (
    <nav aria-label="Shopping shortcuts" className="sb-header-actions">
      <Link aria-label={`Wishlist, ${wishlist.length} saved items`} className="sb-icon-link sb-desktop-icon" href="/wishlist">
        <Icon name="heart" />
        {wishlist.length > 0 && <span className="sb-icon-count">{wishlist.length}</span>}
      </Link>
      <Link aria-label="My profile" className="sb-icon-link sb-desktop-icon" href="/account">
        <Icon name="user" />
      </Link>
      <Link aria-label={`Cart, ${cartCount} items`} className="sb-icon-link sb-cart-link" href="/cart">
        <Icon name="cart" />
        <span>Cart</span>
        <span className={`sb-icon-count${cartCount ? " is-bumped" : ""}`} key={cartCount}>{cartCount}</span>
      </Link>
    </nav>
  );
}
