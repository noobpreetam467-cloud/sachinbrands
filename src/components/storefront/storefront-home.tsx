import Image from "next/image";
import Link from "next/link";
import { getCategories, getProducts } from "@/data/catalog";
import { CatalogStatus } from "./catalog-status";
import { CatalogImage } from "./catalog-image";
import { Icon } from "./icon";
import { ProductSection } from "./product-section";
import { RecentlyViewed } from "./recently-viewed";
import { StorefrontLayout } from "./storefront-layout";
import { getStorefrontContent } from "@/data/storefront-content";

export async function StorefrontHome() {
  const content = await getStorefrontContent();
  const featuredCategoryIds = content?.featured_category_ids ?? [];
  const featuredProductIds = content?.featured_product_ids ?? [];
  const [categoriesResult, bestsellerResult, newResult, trendingResult] =
    await Promise.all([
      getCategories(),
      getProducts(featuredProductIds.length
        ? { ids: featuredProductIds, sort: "popular", pageSize: 4 }
        : { sort: "popular", pageSize: 4 }),
      getProducts({ sort: "newest", pageSize: 4 }),
      getProducts({ sort: "popular", pageSize: 4 }),
    ]);
  const categories = featuredCategoryIds.length
    ? categoriesResult.data
      .filter((category) => featuredCategoryIds.includes(category.id))
      .sort((a, b) => {
      const aIndex = featuredCategoryIds.indexOf(a.id);
      const bIndex = featuredCategoryIds.indexOf(b.id);
      return (aIndex < 0 ? Number.MAX_SAFE_INTEGER : aIndex) -
        (bIndex < 0 ? Number.MAX_SAFE_INTEGER : bIndex);
    })
    : categoriesResult.data;
  const heroHeadline = content?.hero_headline || "Good tech.\nBetter days.";
  const heroDescription = content?.hero_description || "Thoughtfully chosen phones, audio, and everyday essentials. Find the tech that fits your life.";
  const heroImage = content?.hero_image_url || "https://images.unsplash.com/photo-1592899677977-9c10ca588bbd?auto=format&fit=crop&w=1000&q=90";
  const promotionHeadline = content?.promotion_headline || "Make room for a little more wonder.";
  const promotionBody = content?.promotion_body || "Meet the devices designed to make your everyday feel a little more effortless.";
  const promotionImage = content?.promotion_image_url || "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1200&q=88";
  const catalogError =
    categoriesResult.error ||
    bestsellerResult.error ||
    newResult.error ||
    trendingResult.error;

  return (
    <StorefrontLayout active="home">
      {catalogError && (
        <CatalogStatus message="Live catalog not configured. Apply the Supabase catalog migration to display active categories and published products." />
      )}
      <section className="sb-hero">
        <div className="sb-hero-glow" aria-hidden="true" />
        <div className="sb-hero-content" data-reveal>
          <span className="sb-hero-pill"><Icon name="spark" size={15} /> A smarter way to shop tech</span>
          <h1>{heroHeadline.split(/\r?\n/).map((line: string, index: number, lines: string[]) => <span key={`${line}-${index}`}>{index > 0 && <br />}{index === lines.length - 1 ? <em>{line}</em> : line}</span>)}</h1>
          <p>{heroDescription}</p>
          <div className="sb-hero-actions">
            <Link className="sb-button sb-button-primary" href={content?.hero_cta_url || "/products"}>{content?.hero_cta_label || "Shop the collection"} <Icon name="arrow" size={18} /></Link>
            <Link className="sb-button sb-button-glass" href="/categories">Explore categories</Link>
          </div>
          <div className="sb-hero-proof">Discover products currently published in our catalog</div>
        </div>
        <div className="sb-hero-visual" data-reveal>
          <div className="sb-hero-image-backdrop" />
          <Image
            alt="Premium smartphone photographed in a dark studio"
            className="sb-hero-device"
            height={700}
            priority
            src={heroImage}
            width={700}
          />
          <div className="sb-hero-float-card"><span className="sb-hero-float-icon"><Icon name="shield" /></span><span>Chosen with care<strong>Quality comes first</strong></span></div>
          <div className="sb-hero-index"><span>01</span><span className="sb-hero-index-line" /><span>THE EVERYDAY EDIT</span></div>
        </div>
        <div className="sb-hero-bottom"><span>Curated for how you live</span><span>Scroll to explore <span aria-hidden="true">↓</span></span></div>
      </section>

      <section className="sb-category-section sb-section">
        <div className="sb-section-heading" data-reveal>
          <div><span className="sb-eyebrow">Find your next favorite</span><h2>Shop by category</h2></div>
          <Link className="sb-text-link" href="/categories">All categories <Icon name="arrow" size={17} /></Link>
        </div>
        {categories.length ? (
          <div className="sb-category-grid">
            {categories.map((category) => (
              <Link className="sb-category-card" data-reveal href={`/categories/${category.slug}`} key={category.id}>
                <div className="sb-category-image">
                  {category.image ? <CatalogImage alt="" sizes="(max-width: 640px) 44vw, 20vw" src={category.image} /> : <span className="sb-product-image-placeholder" />}
                </div>
                <div className="sb-category-overlay"><span>{category.name}</span><span>{category.description}</span><Icon name="arrow" size={18} /></div>
              </Link>
            ))}
          </div>
        ) : !categoriesResult.error ? (
          <div className="sb-empty-page"><p>Active categories will appear here when configured in the catalog.</p></div>
        ) : null}
      </section>

      {bestsellerResult.data.products.length > 0 && (
        <ProductSection eyebrow={featuredProductIds.length ? "Picked for the storefront" : "Loved for a reason"} title={featuredProductIds.length ? "Featured products" : "Popular products"} products={bestsellerResult.data.products} href="/products?sort=popular" linkLabel="Shop popular products" />
      )}

      <section className="sb-promo-band">
        <div className="sb-promo-copy" data-reveal>
          <span className="sb-eyebrow">A considered upgrade</span>
          <h2>{promotionHeadline}</h2>
          <p>{promotionBody}</p>
          <Link className="sb-button sb-button-light" href={content?.promotion_cta_url || "/products"}>{content?.promotion_cta_label || "Explore products"} <Icon name="arrow" size={18} /></Link>
        </div>
        <div className="sb-promo-image" data-reveal>
          <Image alt="Featured Sachin Brands promotion" fill sizes="(max-width: 760px) 100vw, 50vw" src={promotionImage} />
          <span>Everyday, elevated.</span>
        </div>
      </section>

      {newResult.data.products.length > 0 && (
        <ProductSection eyebrow="Fresh from the edit" title="New arrivals" products={newResult.data.products} href="/products?sort=newest" linkLabel="See what’s new" />
      )}

      <section className="sb-deal-banner" data-reveal>
        <div className="sb-deal-mark"><Icon name="spark" size={28} /></div>
        <div><span className="sb-eyebrow">Good things, thoughtfully priced</span><h2>Find the right fit for your everyday.</h2><p>Prices and availability are read from the live catalog.</p></div>
        <Link className="sb-button sb-button-primary" href="/products">Explore products <Icon name="arrow" size={18} /></Link>
      </section>

      {trendingResult.data.products.length > 0 && (
        <ProductSection eyebrow="On everyone’s radar" title="Trending right now" products={trendingResult.data.products} href="/products?sort=popular" />
      )}
      <RecentlyViewed />

      <section aria-label="Our commitments" className="sb-trust-strip">
        <div><Icon name="shield" /><span><strong>Secure by design</strong><small>Payments coming soon</small></span></div>
        <div><Icon name="truck" /><span><strong>Delivery with care</strong><small>Shipping details</small></span></div>
        <div><Icon name="return" /><span><strong>Here to help</strong><small>Clear returns policy</small></span></div>
      </section>

      <section className="sb-newsletter" data-reveal>
        <div><span className="sb-eyebrow">A note from SB</span><h2>Good things, occasionally.</h2><p>Our newsletter signup isn&apos;t connected yet. Reach out and we&apos;ll let you know when it launches.</p></div>
        <Link className="sb-button sb-button-primary" href="/contact">Contact the team <Icon name="arrow" size={18} /></Link>
      </section>
    </StorefrontLayout>
  );
}
