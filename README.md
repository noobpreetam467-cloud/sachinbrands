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

Configure the Supabase project and `DATABASE_URL` in `.env.local`, then start PostgreSQL for the optional local Prisma tooling:

```bash
docker compose up -d db
npm run db:push
npm run db:seed
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to the values from your Supabase
project. These are used by the Supabase Auth clients. Keep any database
passwords and Supabase secret/service-role keys private; do not use a
service-role key in `NEXT_PUBLIC_` variables.

For Vercel, add those same two variables under **Project → Settings → Environment
Variables** for every environment you deploy (Production, Preview, and
Development), then redeploy. Use the project's **Project URL** for
`NEXT_PUBLIC_SUPABASE_URL` and its **publishable key** (or legacy `anon` key)
for `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Do not put a key beginning
`sb_secret_`, a service-role key, or a database password in either variable.
After setting them, test `/login`, `/signup`, and the catalog in the deployment;
the server checks Supabase-backed routes and reports missing or unsafe public
configuration without blocking unrelated storefront pages.

Open [http://localhost:3000](http://localhost:3000). Use `npm run lint` and
`npm run build` to check the project.

## Customer sign-in

Visit `/login` to sign in with an existing Supabase Auth email/password
account or continue with Google. Enable Google in the Supabase dashboard under
**Authentication → Providers**, and add
`http://localhost:3000/auth/callback` to the Supabase project's allowed
redirect URLs. Add the production callback URL for deployed environments.

Use `/signup` to register with Supabase Auth, then sign in at `/login`.
Successful sign-in opens `/account`. Customer profile, address, wishlist,
order, notification, and return-request data use the signed-in Supabase user
and RLS-protected Supabase tables. Supabase Auth manages credentials and
sessions. Never commit `.env.local` or production credentials.

## Phase 1 storefront and catalog foundation

The responsive UI includes the home page, product catalog and detail pages,
category pages, search, wishlist, cart, login/signup, customer profile and
orders, checkout and order confirmation, contact/about, shipping,
returns, privacy, terms, and a protected admin dashboard. Catalog pages query
published products, active categories, variants, images, and approved reviews
from Supabase. Guest carts and wishlists remain in the browser; signed-in carts
and wishlists merge and synchronize to Supabase. Recently viewed IDs remain
local.
Newsletter and contact forms are not connected to a service. The `/admin` shell
dashboard uses live database-backed management and does not expose sample metrics.

## Apply the Supabase catalog migration

The catalog SQL and public read policies are in
[`supabase/migrations/20261017210000_catalog.sql`](./supabase/migrations/20261017210000_catalog.sql).
Cart, addresses, coupons, orders, inventory reservations, payment records,
checkout RPCs, and their RLS policies are in
[`supabase/migrations/20261018150000_checkout.sql`](./supabase/migrations/20261018150000_checkout.sql).
Customer profiles, durable wishlists, notification preferences and event
records, order status history, return requests, and review eligibility
policies are in
[`supabase/migrations/20261018170000_customer_account.sql`](./supabase/migrations/20261018170000_customer_account.sql).
The secure admin role, administrator-only RLS policies and operations, live
dashboard reporting, product/category/inventory/order/coupon/return/review
management, and editable homepage/store settings are in
[`supabase/migrations/20261018190000_admin_dashboard.sql`](./supabase/migrations/20261018190000_admin_dashboard.sql).
The payment confirmation hardening migration,
[`supabase/migrations/20261018200000_restrict_razorpay_confirmation.sql`](./supabase/migrations/20261018200000_restrict_razorpay_confirmation.sql),
limits the paid-order confirmation RPC to the server-side service role.
Apply it to the connected project using the Supabase SQL Editor (or your
authorized Supabase CLI workflow), in this order: catalog, checkout, customer
account, admin dashboard, then payment confirmation hardening. The account migration provisions each new Supabase Auth user
with a profile, wishlist, and notification preferences, and backfills those
records for existing users. It records new order status transitions and creates
in-app order notifications from actual order changes. Customers can cancel
confirmed unpaid COD orders; delivered orders are eligible for a return request
within the store-configured return window (30 days by default). Return requests do not issue refunds. Reviews are restricted by
RLS to products in the customer's delivered orders, with one review per product
and moderation before publication.
The catalog migration creates the six requested categories,
catalog tables, a security-invoker read view, RLS policies, search indexes, and
the public product-image bucket with admin-metadata-only upload permissions.
Apply the checkout migration after the catalog migration. COD and Razorpay are
disabled by default. After configuring delivery/tax values, enable only the
payment methods the store is ready to accept in `public.store_settings`.
For example, after confirming COD operations are ready, run
`update public.store_settings set cod_enabled = true where id = true;` in the
Supabase SQL Editor. Configure the tax rate and shipping fees to match the
store's applicable rules; the migration defaults them to zero rather than
inventing amounts.
Address, order, cart, inventory, and coupon changes go through authenticated
database functions that validate the session and calculate totals from current
database prices and stock.
The migration defines no sample products; add real products, images, and
variants using a trusted Supabase management workflow. Until the migration is
applied and products are published, the storefront shows explicit unavailable
or empty states instead of sample catalog entries.

The app reads only with `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; never add a service-role key to the
frontend. Use product image URLs from the public `product-images` bucket so
Next.js can optimize those images for responsive display.

### Provisioning store administrators

The admin role is stored in `public.admin_users`; browser-editable profile
data, email addresses, and JWT `app_metadata` do not grant access. After
applying all four migrations and creating the intended user through Supabase
Auth, a Supabase project owner can provision that existing account in the SQL
Editor:

```sql
insert into public.admin_users (user_id)
select id
from auth.users
where email = '<the exact account email>'
on conflict (user_id) do nothing;
```

Confirm the email query identifies exactly one intended account before
running it. Never expose the SQL Editor, database owner credentials, or a
service-role key to the browser. To remove admin access, a project owner can
delete that user's row from `public.admin_users`. Ordinary customers cannot
read or modify that table. The dashboard and its privileged RPCs also verify
the role independently of the rendered UI.

Product/category image uploads use the public `product-images` bucket, with
administrator-only writes restricted to its `catalog/` and `categories/`
folders. The admin UI validates image signatures, limits each file to 5 MB,
and limits the combined product-image upload in one save to 5 MB (10 images
maximum). The Server Action request limit is configured to 6 MB to accommodate
multipart form overhead.
Inventory changes go through an atomic adjustment RPC that records the
administrator and reason. Products and categories are archived rather than
hard-deleted to preserve order history. Order fulfillment follows sequential
status transitions; an admin may only cancel a confirmed, unpaid COD order.
Payment status and refunds cannot be edited in the dashboard. Refunds require
a separately verified payment-provider operation.

### Checkout and Razorpay configuration

Signed-in customers can save Indian shipping addresses and use the checkout
flow. COD is available only when `cod_enabled` is enabled in store settings.
For Razorpay, configure `razorpay_enabled` and set these server-only variables
in the deployment environment (never prefix secrets with `NEXT_PUBLIC_`):

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
```

Because payment credentials were shared in chat, revoke/rotate that Razorpay
key pair in the Razorpay Dashboard before configuring the integration. Add the
new key ID, key secret, webhook secret, and Supabase service-role key as
server-side environment variables in local `.env.local` and the production
deployment environment. Do not paste them into source files, browser settings,
or chat, and never expose the service-role or payment secret through a
`NEXT_PUBLIC_` variable.

Set the Razorpay webhook URL to
`https://<your-domain>/api/razorpay/webhook` and subscribe to
`payment.captured`. The webhook signing secret must match
`RAZORPAY_WEBHOOK_SECRET`. The service-role key is used only by the server-side
payment verification and webhook routes, after their respective provider
verification checks. Without these settings or the applied commerce migration, the
app reports checkout as unavailable and does not claim a payment or order was
completed. Orders awaiting online payment remain pending until Razorpay's
verified callback or webhook confirms payment; customers can resume the same
payment session in `/orders`. Pending payments are not automatically expired
or cancelled because a delayed capture must not silently release reserved
stock; staff reconciliation/cancellation automation remains a production
operations step.

## Site identity

Update `SITE_NAME`, `SITE_TAGLINE`, `SITE_LOGO_PATH`, or `SITE_THEME` in
[`src/config/site.ts`](./src/config/site.ts). Layout metadata and the rendered
storefront read from this configuration.

## Implementation phases

1. **Setup and storefront prototype:** App Router, TypeScript, site
   configuration, premium responsive storefront, reusable demo catalog,
   animations, and customer-facing route structures are in place.
2. **Database:** PostgreSQL, Prisma schema and migrations, catalog seed data,
   administrator seed.
3. **Authentication:** Supabase Auth email/password and Google sign-in,
   cookie-based sessions, email registration, password reset, and the customer
   account area are implemented.
4. **Catalog:** Supabase catalog schema, RLS-protected public reads, product
   listings/details, variants, image galleries, approved reviews, search,
   filters, and pagination are implemented. Populate real products and verify
   against the connected project after applying the catalog migration.
5. **Cart and checkout:** Guest and persistent account carts, safe login merge,
   validated Indian addresses, coupons, server-side shipping/tax calculation,
   atomic stock reservation, COD, and configured Razorpay signature/webhook
   verification are implemented. Apply the checkout migration and configure
   store settings/payment secrets before live orders can be placed.
6. **Customer account and order tracking:** Customer profile, addresses,
    persistent wishlist, in-app order notifications, status history, shipment
    tracking fields, cancellation eligibility, return requests, and verified
    purchaser reviews are implemented. Administrative fulfillment transitions,
    carrier updates, return review, and real refunds still require trusted
    staff/provider operations; no customer request changes a payment to refunded.
    Automated expiry/reconciliation for abandoned pending online payments
    remains a production operations task.
7. **Admin:** Protected dashboard and catalog, order, customer, coupon, content,
    review, inventory, return-request, and store-settings management are
    implemented in code. Apply the admin migration and provision an admin
    account before using the dashboard; live-project permissions and operations
    have not been verified from this development environment.
8. **SEO and polish:** Sitemap, robots, structured data, accessibility,
    responsive refinement, loading/error states, and operational documentation.
9. **Verification:** Focused cart, checkout, account and order tests; production build
    and deployment instructions.

Supabase Auth requires the public project URL and publishable key described
above. The visual storefront prototype can run without live catalog, cart,
payment, newsletter, or contact-service credentials.
