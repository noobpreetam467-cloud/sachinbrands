import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_LOGO_PATH, SITE_NAME } from "@/config/site";
import { Icon } from "./icon";
import { MobileNavigation } from "./mobile-navigation";
import { StorefrontHeaderActions } from "./storefront-header-actions";
import ScrollReveal from "@/app/scroll-reveal";
import { CatalogSearch } from "./catalog-search";
import { getStorefrontContent } from "@/data/storefront-content";

const footerGroups = [
  {
    title: "Explore",
    links: [
      ["All products", "/products"],
      ["Categories", "/categories"],
      ["New arrivals", "/products?sort=newest"],
      ["Best sellers", "/products?sort=popular"],
    ],
  },
  {
    title: "Customer care",
    links: [
      ["Contact us", "/contact"],
      ["Shipping", "/shipping"],
      ["Returns", "/returns"],
      ["My orders", "/orders"],
    ],
  },
  {
    title: "The details",
    links: [
      ["About Sachin Brands", "/about"],
      ["Privacy", "/privacy"],
      ["Terms", "/terms"],
      ["Returns policy", "/returns"],
    ],
  },
];

export async function StorefrontLayout({
  children,
  active = "home",
}: {
  children: ReactNode;
  active?: "home" | "categories" | "wishlist" | "cart" | "profile";
}) {
  const content = await getStorefrontContent();
  const storeName = content?.public_store_name || SITE_NAME;
  return (
    <div className="sb-store">
      <ScrollReveal />
      <header className="sb-header">
        <div className="sb-header-inner">
          <Link aria-label={`${SITE_NAME} home`} className="sb-brand" href="/">
            <Image alt="" height={40} priority src={SITE_LOGO_PATH} width={40} />
            <span>SACHIN<span>BRANDS</span></span>
          </Link>
          <nav aria-label="Main navigation" className="sb-desktop-nav">
            <Link href="/products">Shop</Link>
            <Link href="/categories">Categories</Link>
            <Link href="/products?sort=newest">New arrivals</Link>
            <Link href="/about">Our story</Link>
          </nav>
          <CatalogSearch />
          <StorefrontHeaderActions />
        </div>
      </header>
      <main className="sb-main">{children}</main>
      <footer className="sb-footer">
        <div className="sb-footer-top">
          <div className="sb-footer-brand">
            <Link aria-label={`${SITE_NAME} home`} className="sb-brand" href="/">
              <Image alt="" height={40} src={SITE_LOGO_PATH} width={40} />
              <span>SACHIN<span>BRANDS</span></span>
            </Link>
            <p>Good technology should feel simple. We bring together thoughtful devices and everyday essentials, chosen with care.</p>
            {content?.support_email
              ? <a href={`mailto:${content.support_email}`}><Icon name="mail" size={17} /> {content.support_email}</a>
              : <Link href="/contact"><Icon name="mail" size={17} /> Contact support</Link>}
            {content?.support_phone && <a href={`tel:${content.support_phone}`}><Icon name="phone" size={17} /> {content.support_phone}</a>}
          </div>
          {footerGroups.map((group) => (
            <div className="sb-footer-group" key={group.title}>
              <h2>{group.title}</h2>
              {group.links.map(([label, href]) => <Link href={href} key={label}>{label}</Link>)}
            </div>
          ))}
          <div className="sb-footer-newsletter">
            <span className="sb-eyebrow">THE SB EDIT</span>
            <h2>A little more signal. A lot less noise.</h2>
            <p>Product notes and new arrivals, only when there&apos;s something worth sharing.</p>
            <Link className="sb-button sb-button-outline" href="/contact">Get in touch <Icon name="arrow" size={17} /></Link>
          </div>
        </div>
        <div className="sb-footer-bottom">
          <span>© {new Date().getFullYear()} {storeName}.</span>
          <span>Thoughtfully selected tech. Straightforward service.</span>
        </div>
      </footer>
      <MobileNavigation active={active} />
    </div>
  );
}
