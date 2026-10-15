import Image from "next/image";
import Link from "next/link";
import {
  SITE_LOGO_PATH,
  SITE_NAME,
  SITE_TAGLINE,
} from "@/config/site";

const collections = [
  { name: "Everyday essentials", number: "01", tone: "sage" },
  { name: "Made to last", number: "02", tone: "sand" },
  { name: "Small discoveries", number: "03", tone: "clay" },
];

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 transition-transform group-hover:translate-x-1"
      fill="none"
      viewBox="0 0 20 20"
    >
      <path
        d="M3.75 10h12.5m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            aria-label={`${SITE_NAME} home`}
            className="flex items-center gap-2.5"
            href="/"
          >
            <Image
              alt=""
              className="h-8 w-8"
              height={32}
              priority
              src={SITE_LOGO_PATH}
              width={32}
            />
            <span className="text-sm font-semibold tracking-[0.16em] uppercase">
              {SITE_NAME}
            </span>
          </Link>
          <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm text-foreground/70 sm:flex">
            <a className="transition-colors hover:text-foreground" href="#collections">
              Collections
            </a>
            <a className="transition-colors hover:text-foreground" href="#story">
              Our approach
            </a>
          </nav>
          <a
            className="group inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-foreground/40"
            href="#collections"
          >
            Explore
            <ArrowIcon />
          </a>
          <Link
            className="whitespace-nowrap text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
            href="/login"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 sm:pb-28 sm:pt-20 lg:grid-cols-[1fr_0.9fr] lg:gap-16">
          <div className="max-w-xl">
            <p className="mb-6 text-xs font-semibold tracking-[0.22em] text-accent uppercase">
              A little more intentional
            </p>
            <h1 className="text-5xl leading-[1.06] font-medium tracking-[-0.055em] sm:text-6xl lg:text-7xl">
              {SITE_TAGLINE}
            </h1>
            <p className="mt-6 max-w-md text-base leading-7 text-foreground/65 sm:text-lg">
              Discover thoughtfully selected pieces for the rhythms of real life.
              Quality, simplicity, and a little delight in every detail.
            </p>
            <a
              className="group mt-9 inline-flex items-center gap-3 rounded-full bg-accent px-6 py-3.5 text-sm font-medium text-accent-foreground transition-colors hover:opacity-90"
              href="#collections"
            >
              Discover the collection
              <ArrowIcon />
            </a>
          </div>

          <div
            aria-label="Abstract illustration in warm, natural colors"
            className="relative mx-auto aspect-[1.06] w-full max-w-[34rem] overflow-hidden rounded-[2rem]"
            role="img"
            style={{ backgroundColor: "var(--site-artwork-background)" }}
          >
            <div
              className="absolute -left-[8%] top-[12%] h-[76%] w-[55%] rounded-[48%] rotate-[-18deg]"
              style={{ backgroundColor: "var(--site-artwork-sage)" }}
            />
            <div
              className="absolute right-[8%] top-[8%] h-[62%] w-[49%] rounded-t-full"
              style={{ backgroundColor: "var(--site-artwork-clay)" }}
            />
            <div
              className="absolute bottom-[-12%] left-[28%] h-[76%] w-[45%] rounded-t-[48%]"
              style={{ backgroundColor: "var(--site-artwork-sand)" }}
            />
            <div className="absolute bottom-[9%] right-[9%] h-[24%] w-[23%] rounded-full bg-[#687a54]" />
            <div className="absolute inset-x-7 bottom-7 flex items-end justify-between text-xs font-medium tracking-[0.14em] text-foreground/65 uppercase sm:inset-x-9 sm:bottom-9">
              <span>Thoughtfully chosen</span>
              <span>Since day one</span>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="collections-heading"
          className="border-y border-border bg-white/60"
          id="collections"
        >
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="mb-9 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <p className="mb-3 text-xs font-semibold tracking-[0.2em] text-accent uppercase">
                  Find your favorites
                </p>
                <h2
                  className="text-3xl font-medium tracking-[-0.04em] sm:text-4xl"
                  id="collections-heading"
                >
                  A thoughtful place to begin
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-6 text-foreground/60">
                A considered edit of useful, beautiful things — chosen to bring
                a little more care to every day.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {collections.map((collection) => (
                <article
                  className="rounded-2xl border border-border bg-background p-5 sm:p-6"
                  key={collection.number}
                >
                  <div
                    aria-hidden="true"
                    className="mb-8 flex aspect-[1.45] items-center justify-center overflow-hidden rounded-xl"
                    style={{
                      backgroundColor: `var(--site-collection-${collection.tone})`,
                    }}
                  >
                    <span className="text-5xl font-light tracking-[-0.07em] text-foreground/15 sm:text-6xl">
                      {collection.number}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-medium">{collection.name}</h3>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          aria-labelledby="story-heading"
          className="mx-auto max-w-7xl px-5 py-16 sm:px-8 sm:py-24"
          id="story"
        >
          <div className="mx-auto max-w-2xl text-center">
            <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-accent uppercase">
              Less, but better
            </p>
            <h2
              className="text-3xl leading-tight font-medium tracking-[-0.04em] sm:text-4xl"
              id="story-heading"
            >
              Good things earn their place in your everyday.
            </h2>
            <p className="mt-5 text-base leading-7 text-foreground/65">
              We believe shopping should feel considered, not complicated. Each
              choice starts with usefulness, thoughtful design, and lasting
              value.
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-7 text-sm text-foreground/60 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Link className="font-medium tracking-[0.12em] text-foreground uppercase" href="/">
            {SITE_NAME}
          </Link>
          <p>{SITE_TAGLINE}</p>
          <span>© {new Date().getFullYear()} {SITE_NAME}</span>
        </div>
      </footer>
    </div>
  );
}
