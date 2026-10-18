import Link from "next/link";
import type { StoreProduct } from "@/data/catalog-types";
import { ProductCard } from "./product-card";
import { Icon } from "./icon";

export function ProductSection({
  eyebrow,
  title,
  products,
  href = "/products",
  linkLabel = "View all",
}: {
  eyebrow: string;
  title: string;
  products: StoreProduct[];
  href?: string;
  linkLabel?: string;
}) {
  return (
    <section className="sb-section">
      <div className="sb-section-heading" data-reveal>
        <div>
          <span className="sb-eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
        <Link className="sb-text-link" href={href}>{linkLabel}<Icon name="arrow" size={17} /></Link>
      </div>
      <div className="sb-product-grid">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </section>
  );
}
