create extension if not exists pg_trgm with schema extensions;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  description text not null default '',
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  brand text not null,
  description text not null default '',
  specifications jsonb not null default '{}'::jsonb check (jsonb_typeof(specifications) = 'object'),
  price_inr numeric(12, 2) not null check (price_inr > 0),
  original_price_inr numeric(12, 2) check (
    original_price_inr is null or original_price_inr >= price_inr
  ),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  popularity_score integer not null default 0 check (popularity_score >= 0),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  alt_text text,
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  unique (product_id, position)
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text not null unique,
  name text not null,
  attributes jsonb not null default '{}'::jsonb check (jsonb_typeof(attributes) = 'object'),
  price_inr numeric(12, 2) check (price_inr is null or price_inr > 0),
  original_price_inr numeric(12, 2) check (
    original_price_inr is null or original_price_inr >= coalesce(price_inr, 0)
  ),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index if not exists products_public_category_created_idx
  on public.products (category_id, created_at desc)
  where status = 'published';
create index if not exists products_public_price_idx
  on public.products (price_inr)
  where status = 'published';
create index if not exists products_public_popularity_idx
  on public.products (popularity_score desc)
  where status = 'published';
create index if not exists products_name_trgm_idx
  on public.products using gin (name extensions.gin_trgm_ops);
create index if not exists products_brand_trgm_idx
  on public.products using gin (brand extensions.gin_trgm_ops);
create index if not exists categories_name_trgm_idx
  on public.categories using gin (name extensions.gin_trgm_ops);
create index if not exists product_images_product_position_idx
  on public.product_images (product_id, position);
create index if not exists product_variants_available_idx
  on public.product_variants (product_id, stock_quantity)
  where is_active;
create index if not exists reviews_approved_product_rating_idx
  on public.reviews (product_id, rating)
  where status = 'approved';

create or replace function public.set_catalog_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_catalog_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_catalog_updated_at();

drop trigger if exists product_variants_set_updated_at on public.product_variants;
create trigger product_variants_set_updated_at
before update on public.product_variants
for each row execute function public.set_catalog_updated_at();

drop trigger if exists reviews_set_updated_at on public.reviews;
create trigger reviews_set_updated_at
before update on public.reviews
for each row execute function public.set_catalog_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.reviews enable row level security;

grant select on public.categories, public.products, public.product_images,
  public.product_variants, public.reviews to anon, authenticated;
grant insert on public.reviews to authenticated;

drop policy if exists "Anyone can read active categories" on public.categories;
create policy "Anyone can read active categories"
  on public.categories for select
  to anon, authenticated
  using (is_active);

drop policy if exists "Anyone can read published products" on public.products;
create policy "Anyone can read published products"
  on public.products for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "Anyone can read published product images" on public.product_images;
create policy "Anyone can read published product images"
  on public.product_images for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'published'
    )
  );

drop policy if exists "Anyone can read active variants for published products" on public.product_variants;
create policy "Anyone can read active variants for published products"
  on public.product_variants for select
  to anon, authenticated
  using (
    is_active and exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'published'
    )
  );

drop policy if exists "Anyone can read approved reviews for published products" on public.reviews;
create policy "Anyone can read approved reviews for published products"
  on public.reviews for select
  to anon, authenticated
  using (
    status = 'approved' and exists (
      select 1 from public.products p
      where p.id = product_id and p.status = 'published'
    )
  );

drop policy if exists "Customers can submit pending reviews for themselves" on public.reviews;
create policy "Customers can submit pending reviews for themselves"
  on public.reviews for insert
  to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');

create or replace view public.catalog_products
with (security_invoker = true)
as
select
  p.id,
  p.id as product_id,
  p.slug,
  p.name,
  p.brand,
  p.description,
  p.specifications,
  p.price_inr,
  p.original_price_inr,
  p.category_id,
  c.name as category_name,
  c.slug as category_slug,
  p.popularity_score,
  p.created_at,
  coalesce(image.image_url, c.image_url) as primary_image_url,
  image.alt_text as primary_image_alt,
  coalesce(reviews.rating, 0)::numeric(3, 2) as rating,
  coalesce(reviews.review_count, 0)::integer as review_count,
  coalesce(stock.stock_quantity, 0)::integer as stock_quantity,
  coalesce(stock.available_variant_stock_quantity, 0)::integer as available_variant_stock_quantity,
  stock.available_variant_id,
  coalesce(stock.variant_price_inr, p.price_inr) as variant_price_inr,
  coalesce(stock.variant_original_price_inr, p.original_price_inr) as variant_original_price_inr,
  stock.sku,
  null::text as badge
from public.products p
join public.categories c on c.id = p.category_id and c.is_active
left join lateral (
  select pi.image_url, pi.alt_text
  from public.product_images pi
  where pi.product_id = p.id
  order by pi.position, pi.created_at
  limit 1
) image on true
left join lateral (
  select round(avg(r.rating)::numeric, 2) as rating, count(*) as review_count
  from public.reviews r
  where r.product_id = p.id and r.status = 'approved'
) reviews on true
left join lateral (
  select pv.id as available_variant_id,
         pv.sku,
         pv.price_inr as variant_price_inr,
         pv.original_price_inr as variant_original_price_inr,
         pv.stock_quantity as available_variant_stock_quantity,
         (select sum(available.stock_quantity)
          from public.product_variants available
          where available.product_id = p.id
            and available.is_active
            and available.stock_quantity > 0) as stock_quantity
  from public.product_variants pv
  where pv.product_id = p.id and pv.is_active and pv.stock_quantity > 0
  order by pv.sku
  limit 1
) stock on true
where p.status = 'published';

grant select on public.catalog_products to anon, authenticated;

insert into public.categories (slug, name, description)
values
  ('smartphones', 'Smartphones', 'Smartphones and mobile devices'),
  ('electronics', 'Electronics', 'Everyday electronics and devices'),
  ('accessories', 'Accessories', 'Accessories for your technology'),
  ('audio', 'Audio', 'Headphones, speakers, and audio gear'),
  ('chargers-and-cables', 'Chargers and Cables', 'Power adapters and charging essentials'),
  ('smart-gadgets', 'Smart Gadgets', 'Useful connected gadgets')
on conflict (slug) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read product images" on storage.objects;
create policy "Public can read product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    and (storage.foldername(name))[1] = 'catalog'
  );

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    and (storage.foldername(name))[1] = 'catalog'
  )
  with check (
    bucket_id = 'product-images'
    and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    and (storage.foldername(name))[1] = 'catalog'
  );

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and coalesce((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false)
    and (storage.foldername(name))[1] = 'catalog'
  );
