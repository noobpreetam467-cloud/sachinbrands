# Storefront

A mobile-first commerce application built with Next.js App Router and TypeScript.
The project is being implemented in verified phases, with a responsive
storefront, customer sign-in, and a protected customer dashboard in place.

## Run locally

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env`, set a generated `AUTH_SECRET`, then start
PostgreSQL and prepare the database:

```bash
docker compose up -d db
npm run db:push
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use `npm run lint` and
`npm run build` to check the project.

## Customer sign-in

Visit `/login` to sign in with the email and password of an existing customer
account or continue with Google. Successful sign-in opens the protected
`/account` dashboard, which shows the signed-in customer's recent orders,
account details, and default shipping address. Email/password authentication
uses the bcrypt hashes stored in `User.passwordHash`; email/password accounts
are provisioned through the existing database seed rather than public sign-up.
The first successful Google sign-in creates a customer account automatically.

To enable Google sign-in, create a Google OAuth web client and add its client ID
and secret as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in `.env`. Add
`http://localhost:3000/api/auth/callback/google` as an authorized redirect URI.
For deployments, configure the equivalent production callback URL and a unique
`AUTH_SECRET`. Never commit `.env` or production credentials.

## Site identity

Update `SITE_NAME`, `SITE_TAGLINE`, `SITE_LOGO_PATH`, or `SITE_THEME` in
[`src/config/site.ts`](./src/config/site.ts). Layout metadata and the rendered
storefront read from this configuration.

## Implementation phases

1. **Setup:** App Router, TypeScript, Tailwind, site configuration, responsive
   storefront shell.
2. **Database:** PostgreSQL, Prisma schema and migrations, catalog seed data,
   administrator seed.
3. **Authentication:** Email/password and Google sign-in, secure sessions, and
   protected customer dashboard are implemented. Email verification, password
   recovery, account registration, and rate limits remain future work.
4. **Catalog:** Categories, brands, products, variants, media, search, filters,
   reviews, and SEO metadata.
5. **Cart:** Guest and account carts, inventory-aware quantities, coupons, and
   price calculations.
6. **Checkout and payments:** Addresses, shipping, tax, COD, Stripe/Razorpay
   adapter, payment webhooks, and order lifecycle.
7. **Customer account:** Profile, addresses, orders, tracking, returns,
   wishlist, and reviews.
8. **Admin:** Protected dashboard and catalog, order, customer, coupon, content,
   review, and store-settings management.
9. **SEO and polish:** Sitemap, robots, structured data, accessibility,
   responsive refinement, loading/error states, and operational documentation.
10. **Verification:** Focused cart, checkout, and order tests; production build
    and deployment instructions.

Database and service environment variables will be documented here when those
integrations are introduced; no secrets are required to run Phase 1.
