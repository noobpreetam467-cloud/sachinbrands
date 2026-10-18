create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  provisioned_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from anon, authenticated;

create or replace function public.is_store_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and exists (
    select 1 from public.admin_users where user_id = auth.uid()
  )
$$;
revoke all on function public.is_store_admin() from public, anon;
grant execute on function public.is_store_admin() to authenticated;

create table if not exists public.storefront_content (
  id boolean primary key default true check (id),
  hero_headline text not null default 'Technology, thoughtfully chosen.',
  hero_description text not null default '',
  hero_cta_label text not null default 'Shop now',
  hero_cta_url text not null default '/products' check (hero_cta_url ~ '^/'),
  hero_image_url text,
  support_email text not null default '',
  support_phone text not null default '',
  return_policy text not null default '',
  shipping_policy text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.storefront_content
  drop constraint if exists storefront_content_hero_cta_url_check;
alter table public.storefront_content
  add constraint storefront_content_hero_cta_url_check
    check (left(hero_cta_url, 1) = '/' and left(hero_cta_url, 2) <> '//');
insert into public.storefront_content (id) values (true) on conflict (id) do nothing;
alter table public.storefront_content
  add column if not exists public_store_name text not null default 'Sachin Brands',
  add column if not exists return_window_days integer not null default 30 check (return_window_days between 0 and 365),
  add column if not exists featured_category_ids uuid[] not null default '{}',
  add column if not exists featured_product_ids uuid[] not null default '{}',
  add column if not exists promotion_headline text not null default '',
  add column if not exists promotion_body text not null default '',
  add column if not exists promotion_cta_label text not null default 'Explore products',
  add column if not exists promotion_cta_url text not null default '/products',
  add column if not exists promotion_image_url text;
alter table public.storefront_content
  drop constraint if exists storefront_content_promotion_cta_url_check;
alter table public.storefront_content
  add constraint storefront_content_promotion_cta_url_check
    check (left(promotion_cta_url, 1) = '/' and left(promotion_cta_url, 2) <> '//');

alter table public.categories
  add column if not exists display_order integer not null default 0;

alter table public.store_settings
  add column if not exists store_name text not null default 'Sachin Brands',
  add column if not exists support_email text not null default '',
  add column if not exists support_phone text not null default '',
  add column if not exists return_window_days integer not null default 30 check (return_window_days between 0 and 365);
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'paid', 'due_on_delivery', 'failed', 'refunded', 'cancelled'));
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'paid', 'due_on_delivery', 'failed', 'refunded', 'cancelled'));
alter table public.storefront_content enable row level security;
alter table public.coupons enable row level security;
alter table public.inventory_movements
  add column if not exists actor_user_id uuid references auth.users(id) on delete set null,
  add column if not exists note text;
alter table public.inventory_movements drop constraint if exists inventory_movements_reason_check;
alter table public.inventory_movements add constraint inventory_movements_reason_check
  check (reason in ('order_reserved', 'reservation_released', 'admin_adjustment'));

drop trigger if exists storefront_content_set_updated_at on public.storefront_content;
create trigger storefront_content_set_updated_at before update on public.storefront_content
for each row execute function public.set_catalog_updated_at();

grant select on public.storefront_content to anon, authenticated;
grant select, insert, update, delete on public.products, public.product_images,
  public.product_variants, public.categories, public.coupons to authenticated;
grant select on public.store_settings to authenticated;
revoke update on public.product_variants from authenticated;
grant update (product_id, sku, name, attributes, price_inr, original_price_inr, is_active)
  on public.product_variants to authenticated;
grant update on public.reviews to authenticated;
grant update (cod_enabled, razorpay_enabled, shipping_fee_inr, free_shipping_threshold_inr,
  tax_rate_percent, store_name, support_email, support_phone, return_window_days)
  on public.store_settings to authenticated;
grant update (hero_headline, hero_description, hero_cta_label, hero_cta_url, hero_image_url,
  public_store_name, return_window_days, support_email, support_phone, return_policy, shipping_policy, featured_category_ids,
  featured_product_ids, promotion_headline, promotion_body, promotion_cta_label, promotion_cta_url,
  promotion_image_url)
  on public.storefront_content to authenticated;
grant select, insert, update, delete on public.storefront_content to authenticated;
grant select on public.inventory_movements to authenticated;
grant select on public.return_requests, public.notifications, public.order_status_events,
  public.payments to authenticated;
grant select on public.orders, public.order_items to authenticated;
revoke insert, update, delete on public.orders, public.order_items, public.payments,
  public.return_requests, public.notifications, public.order_status_events,
  public.inventory_movements from anon, authenticated;

drop policy if exists "Admins manage categories" on public.categories;
create policy "Admins manage categories" on public.categories
  for all to authenticated using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
drop policy if exists "Admins manage products" on public.products;
create policy "Admins manage products" on public.products
  for all to authenticated using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
drop policy if exists "Admins manage product images" on public.product_images;
create policy "Admins manage product images" on public.product_images
  for all to authenticated using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
drop policy if exists "Admins manage product variants" on public.product_variants;
create policy "Admins manage product variants" on public.product_variants
  for all to authenticated using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
drop policy if exists "Admins manage coupons" on public.coupons;
create policy "Admins manage coupons" on public.coupons
  for all to authenticated using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
drop policy if exists "Admins read store settings" on public.store_settings;
create policy "Admins read store settings" on public.store_settings
  for select to authenticated using ((select public.is_store_admin()));
drop policy if exists "Admins update store settings" on public.store_settings;
create policy "Admins update store settings" on public.store_settings
  for update to authenticated using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
drop policy if exists "Admins manage storefront content" on public.storefront_content;
create policy "Admins manage storefront content" on public.storefront_content
  for all to authenticated using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
drop policy if exists "Public can read storefront content" on public.storefront_content;
create policy "Public can read storefront content" on public.storefront_content
  for select to anon, authenticated using (true);

drop policy if exists "Admins read all customer orders" on public.orders;
create policy "Admins read all customer orders" on public.orders
  for select to authenticated using ((select public.is_store_admin()));
drop policy if exists "Admins read all order items" on public.order_items;
create policy "Admins read all order items" on public.order_items
  for select to authenticated using ((select public.is_store_admin()));
drop policy if exists "Admins read all payments" on public.payments;
create policy "Admins read all payments" on public.payments
  for select to authenticated using ((select public.is_store_admin()));
drop policy if exists "Admins read all addresses" on public.addresses;
create policy "Admins read all addresses" on public.addresses
  for select to authenticated using ((select public.is_store_admin()));
drop policy if exists "Admins read all profiles" on public.profiles;
create policy "Admins read all profiles" on public.profiles
  for select to authenticated using ((select public.is_store_admin()));
drop policy if exists "Admins read all returns" on public.return_requests;
create policy "Admins read all returns" on public.return_requests
  for select to authenticated using ((select public.is_store_admin()));
drop policy if exists "Admins read all notifications" on public.notifications;
create policy "Admins read all notifications" on public.notifications
  for select to authenticated using ((select public.is_store_admin()));
drop policy if exists "Admins read all order status events" on public.order_status_events;
create policy "Admins read all order status events" on public.order_status_events
  for select to authenticated using ((select public.is_store_admin()));
drop policy if exists "Admins read inventory movements" on public.inventory_movements;
create policy "Admins read inventory movements" on public.inventory_movements
  for select to authenticated using ((select public.is_store_admin()));
drop policy if exists "Admins read all reviews" on public.reviews;
create policy "Admins read all reviews" on public.reviews
  for select to authenticated using ((select public.is_store_admin()));
drop policy if exists "Admins moderate reviews" on public.reviews;
create policy "Admins moderate reviews" on public.reviews
  for update to authenticated using ((select public.is_store_admin()))
  with check ((select public.is_store_admin()));
drop policy if exists "Admins manage inventory movements" on public.inventory_movements;
create policy "Admins manage inventory movements" on public.inventory_movements
  for select to authenticated using ((select public.is_store_admin()));

drop policy if exists "Admins upload product images" on storage.objects;
drop policy if exists "Admins can upload product images" on storage.objects;
drop policy if exists "Admins can update product images" on storage.objects;
drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins upload product images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (select public.is_store_admin())
    and (storage.foldername(name))[1] in ('catalog', 'categories')
  );
drop policy if exists "Admins update product image objects" on storage.objects;
create policy "Admins update product image objects"
  on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and (select public.is_store_admin()))
  with check (bucket_id = 'product-images' and (select public.is_store_admin()));
drop policy if exists "Admins delete product image objects" on storage.objects;
create policy "Admins delete product image objects"
  on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and (select public.is_store_admin()));

create or replace function public.admin_dashboard_metrics(p_days integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
  v_result jsonb;
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  if p_days not in (7, 30, 90) then raise exception 'Unsupported reporting range'; end if;
  v_start := date_trunc('day', now()) - make_interval(days => p_days - 1);
  select jsonb_build_object(
    'orders_total', (select count(*) from public.orders),
    'revenue_inr', (select coalesce(sum(total_inr), 0) from public.orders
      where payment_status = 'paid' and status <> 'cancelled'),
    'pending_orders', (select count(*) from public.orders
      where status in ('pending_payment', 'confirmed', 'processing')),
    'customer_count', (select count(*) from auth.users u
      where not exists (select 1 from public.admin_users a where a.user_id = u.id)),
    'active_products', (select count(*) from public.products where status = 'published'),
    'low_stock_count', (select count(*) from public.product_variants
      where is_active and stock_quantity <= 5),
    'sales_series', coalesce((
      select jsonb_agg(jsonb_build_object('date', dates.day::date, 'revenue_inr', coalesce(sales.total, 0))
        order by dates.day)
      from generate_series(v_start::date, now()::date, interval '1 day') dates(day)
      left join lateral (
        select sum(o.total_inr) as total from public.orders o
        where o.payment_status = 'paid' and o.status <> 'cancelled'
          and o.created_at >= dates.day and o.created_at < dates.day + interval '1 day'
      ) sales on true
    ), '[]'::jsonb),
    'recent_orders', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', o.id, 'order_number', o.order_number, 'status', o.status,
        'payment_status', o.payment_status, 'payment_method', o.payment_method,
        'total_inr', o.total_inr, 'created_at', o.created_at,
        'customer_email', u.email, 'customer_name', coalesce(p.full_name, '')
      ) order by o.created_at desc)
      from (
        select * from public.orders order by created_at desc limit 10
      ) o
      join auth.users u on u.id = o.user_id
      left join public.profiles p on p.user_id = o.user_id
    ), '[]'::jsonb),
    'best_sellers', coalesce((
      select jsonb_agg(jsonb_build_object('product_name', sales.product_name,
        'quantity_sold', sales.quantity_sold, 'revenue_inr', sales.revenue_inr)
        order by sales.quantity_sold desc)
      from (
        select oi.product_name, sum(oi.quantity)::integer as quantity_sold,
          sum(oi.line_total_inr) as revenue_inr
        from public.order_items oi join public.orders o on o.id = oi.order_id
        where o.payment_status = 'paid' and o.status <> 'cancelled'
        group by oi.product_name order by quantity_sold desc limit 5
      ) sales
    ), '[]'::jsonb),
    'low_stock_items', coalesce((
      select jsonb_agg(jsonb_build_object('variant_id', v.id, 'product_name', p.name,
        'variant_name', v.name, 'sku', v.sku, 'stock_quantity', v.stock_quantity)
        order by v.stock_quantity asc)
      from (
        select v.id, v.name, v.sku, v.stock_quantity, v.product_id
        from public.product_variants v
        where v.is_active and v.stock_quantity <= 5
        order by v.stock_quantity asc limit 10
      ) v join public.products p on p.id = v.product_id
    ), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;
revoke all on function public.admin_dashboard_metrics(integer) from public, anon;
grant execute on function public.admin_dashboard_metrics(integer) to authenticated;

create or replace function public.admin_customer_list(p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_total bigint;
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  if p_limit not between 1 and 100 or p_offset < 0 then raise exception 'Invalid pagination'; end if;
  select count(*) into v_total from auth.users u
    where not exists (select 1 from public.admin_users a where a.user_id = u.id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'user_id', rows.id, 'email', rows.email, 'full_name', rows.full_name,
    'created_at', rows.created_at, 'orders_count', rows.orders_count,
    'lifetime_spend_inr', rows.lifetime_spend_inr
  ) order by rows.created_at desc), '[]'::jsonb) into v_result
  from (
    select u.id, u.email, coalesce(p.full_name, '') as full_name, u.created_at,
      count(o.id)::integer as orders_count,
      coalesce(sum(o.total_inr), 0) as lifetime_spend_inr
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    left join public.orders o on o.user_id = u.id and o.payment_status = 'paid' and o.status <> 'cancelled'
    where not exists (select 1 from public.admin_users a where a.user_id = u.id)
    group by u.id, u.email, p.full_name, u.created_at
    order by u.created_at desc limit p_limit offset p_offset
  ) rows;
  return jsonb_build_object('total', v_total, 'customers', v_result);
end;
$$;
revoke all on function public.admin_customer_list(integer, integer) from public, anon;
grant execute on function public.admin_customer_list(integer, integer) to authenticated;

create or replace function public.admin_save_product(
  p_product jsonb, p_variants jsonb, p_image_urls jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid;
  v_variant record;
  v_current_variant uuid;
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  if jsonb_typeof(p_product) <> 'object'
    or jsonb_typeof(p_variants) <> 'array'
    or jsonb_array_length(p_variants) not between 1 and 40
    or jsonb_typeof(p_image_urls) <> 'array'
    or jsonb_array_length(p_image_urls) > 10 then
    raise exception 'Invalid product details';
  end if;
  if length(trim(p_product ->> 'name')) not between 2 and 160
    or length(trim(p_product ->> 'brand')) not between 1 and 100
    or (p_product ->> 'slug') !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    or jsonb_typeof(p_product -> 'specifications') <> 'object'
    or (p_product ->> 'price_inr')::numeric <= 0
    or (p_product ->> 'original_price_inr') is not null
      and (p_product ->> 'original_price_inr')::numeric < (p_product ->> 'price_inr')::numeric
    or p_product ->> 'status' not in ('draft', 'published', 'archived') then
    raise exception 'Product fields are invalid';
  end if;
  if not exists (select 1 from public.categories
    where id = (p_product ->> 'category_id')::uuid and is_active) then
    raise exception 'Choose an active category';
  end if;

  if nullif(p_product ->> 'id', '') is null
    or not exists (select 1 from public.products where id = (p_product ->> 'id')::uuid) then
    v_product_id := coalesce(nullif(p_product ->> 'id', '')::uuid, gen_random_uuid());
    insert into public.products (
      id, category_id, slug, name, brand, description, specifications,
      price_inr, original_price_inr, status, published_at
    ) values (
      v_product_id, (p_product ->> 'category_id')::uuid, trim(p_product ->> 'slug'),
      trim(p_product ->> 'name'), trim(p_product ->> 'brand'),
      coalesce(p_product ->> 'description', ''),
      p_product -> 'specifications',
      (p_product ->> 'price_inr')::numeric,
      nullif(p_product ->> 'original_price_inr', '')::numeric,
      p_product ->> 'status',
      case when p_product ->> 'status' = 'published' then now() else null end
    ) returning id into v_product_id;
  else
    v_product_id := (p_product ->> 'id')::uuid;
    update public.products set
      category_id = (p_product ->> 'category_id')::uuid,
      slug = trim(p_product ->> 'slug'),
      name = trim(p_product ->> 'name'),
      brand = trim(p_product ->> 'brand'),
      description = coalesce(p_product ->> 'description', ''),
      specifications = p_product -> 'specifications',
      price_inr = (p_product ->> 'price_inr')::numeric,
      original_price_inr = nullif(p_product ->> 'original_price_inr', '')::numeric,
      status = p_product ->> 'status',
      published_at = case
        when p_product ->> 'status' <> 'published' then null
        else coalesce(published_at, now())
      end
    where id = v_product_id;
    if not found then raise exception 'Product not found'; end if;
  end if;

  for v_variant in
    select * from jsonb_to_recordset(p_variants) as rows(
      id uuid, sku text, name text, attributes jsonb,
      price_inr numeric, original_price_inr numeric,
      initial_stock integer, is_active boolean
    )
  loop
    if length(trim(v_variant.sku)) not between 1 and 100
      or length(trim(v_variant.name)) not between 1 and 160
      or jsonb_typeof(v_variant.attributes) <> 'object'
      or v_variant.initial_stock < 0
      or v_variant.price_inr is not null and v_variant.price_inr <= 0
      or v_variant.original_price_inr is not null
        and v_variant.original_price_inr < coalesce(v_variant.price_inr, (p_product ->> 'price_inr')::numeric) then
      raise exception 'Variant fields are invalid';
    end if;
    if v_variant.id is null then
      insert into public.product_variants (
        product_id, sku, name, attributes, price_inr,
        original_price_inr, stock_quantity, is_active
      ) values (
        v_product_id, trim(v_variant.sku), trim(v_variant.name),
        v_variant.attributes, v_variant.price_inr, v_variant.original_price_inr,
        v_variant.initial_stock, coalesce(v_variant.is_active, true)
      );
    else
      update public.product_variants set
        sku = trim(v_variant.sku),
        name = trim(v_variant.name),
        attributes = v_variant.attributes,
        price_inr = v_variant.price_inr,
        original_price_inr = v_variant.original_price_inr,
        is_active = coalesce(v_variant.is_active, true)
      where id = v_variant.id and product_id = v_product_id;
      if not found then raise exception 'Product variant not found'; end if;
    end if;
  end loop;

  delete from public.product_images where product_id = v_product_id;
  insert into public.product_images (product_id, image_url, alt_text, position)
  select v_product_id, rows.url, trim(p_product ->> 'name'), rows.position
  from jsonb_to_recordset(p_image_urls) as rows(url text, position integer);
  return v_product_id;
end;
$$;
revoke all on function public.admin_save_product(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.admin_save_product(jsonb, jsonb, jsonb) to authenticated;

create or replace function public.record_initial_admin_stock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.stock_quantity > 0 then
    insert into public.inventory_movements (variant_id, quantity_change, reason, actor_user_id, note)
    values (new.id, new.stock_quantity, 'admin_adjustment', auth.uid(), 'Initial stock set during variant creation');
  end if;
  return new;
end;
$$;
revoke all on function public.record_initial_admin_stock() from public, anon, authenticated;
drop trigger if exists product_variants_record_initial_admin_stock on public.product_variants;
create trigger product_variants_record_initial_admin_stock after insert on public.product_variants
for each row execute function public.record_initial_admin_stock();

create or replace function public.admin_adjust_inventory(
  p_variant_id uuid, p_delta integer, p_note text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stock integer;
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  if p_delta = 0 or abs(p_delta) > 100000 then raise exception 'Invalid stock adjustment'; end if;
  if length(trim(p_note)) not between 5 and 500 then raise exception 'Provide an inventory adjustment reason'; end if;
  select stock_quantity into v_stock from public.product_variants
    where id = p_variant_id for update;
  if not found then raise exception 'Product variant not found'; end if;
  if v_stock + p_delta < 0 then raise exception 'Stock cannot be negative'; end if;
  update public.product_variants set stock_quantity = v_stock + p_delta where id = p_variant_id;
  insert into public.inventory_movements (variant_id, quantity_change, reason, actor_user_id, note)
  values (p_variant_id, p_delta, 'admin_adjustment', auth.uid(), trim(p_note));
  return v_stock + p_delta;
end;
$$;
revoke all on function public.admin_adjust_inventory(uuid, integer, text) from public, anon;
grant execute on function public.admin_adjust_inventory(uuid, integer, text) to authenticated;

create or replace function public.admin_update_order_fulfillment(
  p_order_id uuid, p_status text, p_carrier text default null,
  p_tracking_number text default null, p_tracking_url text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_expected text;
  v_line record;
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  if p_status not in ('processing', 'shipped', 'delivered', 'cancelled') then
    raise exception 'Unsupported order fulfillment transition';
  end if;
  if p_carrier is not null and length(trim(p_carrier)) > 100 then raise exception 'Carrier name is too long'; end if;
  if p_tracking_number is not null and length(trim(p_tracking_number)) > 150 then raise exception 'Tracking number is too long'; end if;
  if p_tracking_url is not null and p_tracking_url !~ '^https://[^[:space:]]+$' then raise exception 'Tracking link must use HTTPS'; end if;
  if p_status = 'shipped' and (
    nullif(trim(p_carrier), '') is null
    or nullif(trim(p_tracking_number), '') is null
    or p_tracking_url is null
    or p_tracking_url !~ '^https://[^[:space:]]+$'
  ) then raise exception 'Carrier and valid HTTPS tracking details are required'; end if;
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if p_status = 'cancelled' then
    if v_order.status <> 'confirmed' or v_order.payment_method <> 'cod'
      or v_order.payment_status <> 'due_on_delivery' then
      raise exception 'Only confirmed, unpaid COD orders may be cancelled here';
    end if;
    for v_line in select variant_id, quantity from public.order_items where order_id = p_order_id loop
      update public.product_variants
        set stock_quantity = stock_quantity + v_line.quantity
        where id = v_line.variant_id;
      insert into public.inventory_movements (variant_id, order_id, quantity_change, reason, actor_user_id, note)
      values (v_line.variant_id, p_order_id, v_line.quantity, 'reservation_released', auth.uid(), 'Admin cancelled COD order');
    end loop;
    update public.orders set status = 'cancelled', payment_status = 'cancelled', cancelled_at = now()
      where id = p_order_id;
    update public.payments set status = 'cancelled'
      where order_id = p_order_id and status = 'due_on_delivery';
    return;
  end if;
  v_expected := case v_order.status
    when 'confirmed' then 'processing'
    when 'processing' then 'shipped'
    when 'shipped' then 'delivered'
    else null
  end;
  if p_status <> v_expected then raise exception 'Order status transition is not permitted'; end if;
  update public.orders set status = p_status,
    carrier = case when p_status = 'shipped' then nullif(trim(p_carrier), '') else carrier end,
    tracking_number = case when p_status = 'shipped' then nullif(trim(p_tracking_number), '') else tracking_number end,
    tracking_url = case when p_status = 'shipped' then nullif(trim(p_tracking_url), '') else tracking_url end
  where id = p_order_id;
end;
$$;
revoke all on function public.admin_update_order_fulfillment(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_update_order_fulfillment(uuid, text, text, text, text) to authenticated;

create or replace function public.admin_review_return(p_return_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  if p_status not in ('approved', 'rejected', 'received', 'closed') then raise exception 'Unsupported return status'; end if;
  update public.return_requests set status = p_status
  where id = p_return_id and (
    (status = 'pending' and p_status in ('approved', 'rejected'))
    or (status = 'approved' and p_status = 'received')
    or (status = 'received' and p_status = 'closed')
  );
  if not found then raise exception 'Return request not found or already closed'; end if;
end;
$$;
revoke all on function public.admin_review_return(uuid, text) from public, anon;
grant execute on function public.admin_review_return(uuid, text) to authenticated;

create or replace function public.request_customer_return(p_order_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
  v_return_window integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if length(trim(p_reason)) not between 10 and 1000 then
    raise exception 'Please provide a return reason between 10 and 1000 characters';
  end if;
  select return_window_days into v_return_window from public.store_settings where id = true;
  if not found then raise exception 'Store return settings are unavailable'; end if;
  if not exists (
    select 1 from public.orders
    where id = p_order_id and user_id = v_user_id
      and status = 'delivered'
      and delivered_at >= now() - make_interval(days => v_return_window)
  ) then raise exception 'This order is outside the configured return window'; end if;
  insert into public.return_requests (user_id, order_id, reason)
  values (v_user_id, p_order_id, trim(p_reason))
  returning id into v_request_id;
  return v_request_id;
exception
  when unique_violation then raise exception 'A return request already exists for this order';
end;
$$;
revoke all on function public.request_customer_return(uuid, text) from public, anon;
grant execute on function public.request_customer_return(uuid, text) to authenticated;

create or replace function public.can_request_customer_return(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
    and exists (
      select 1 from public.orders o
      where o.id = p_order_id and o.user_id = auth.uid()
        and o.status = 'delivered'
        and o.delivered_at >= now() - make_interval(days => (
          select return_window_days from public.store_settings where id = true
        ))
        and not exists (
          select 1 from public.return_requests rr
          where rr.order_id = o.id and rr.user_id = auth.uid()
        )
    )
$$;
revoke all on function public.can_request_customer_return(uuid) from public, anon;
grant execute on function public.can_request_customer_return(uuid) to authenticated;

create or replace function public.admin_order_list(
  p_limit integer default 20, p_offset integer default 0,
  p_status text default null, p_search text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_rows jsonb;
  v_total bigint;
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  if p_limit not between 1 and 100 or p_offset < 0 then raise exception 'Invalid pagination'; end if;
  if p_status is not null and p_status not in ('pending_payment', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled') then
    raise exception 'Invalid order status filter';
  end if;
  select count(*) into v_total
  from public.orders o join auth.users u on u.id = o.user_id
  where (p_status is null or o.status = p_status)
    and (nullif(trim(p_search), '') is null or
      o.order_number ilike '%' || trim(p_search) || '%' or
      u.email ilike '%' || trim(p_search) || '%');
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', page.id, 'order_number', page.order_number, 'status', page.status,
    'payment_status', page.payment_status, 'payment_method', page.payment_method,
    'total_inr', page.total_inr, 'created_at', page.created_at,
    'customer_email', page.email, 'customer_name', page.customer_name,
    'address_snapshot', page.address_snapshot,
    'items', page.items, 'return_requests', page.return_requests,
    'status_events', page.status_events, 'tracking_number', page.tracking_number,
    'carrier', page.carrier, 'tracking_url', page.tracking_url
  ) order by page.created_at desc), '[]'::jsonb) into v_rows
  from (
    select o.id, o.order_number, o.status, o.payment_status, o.payment_method,
      o.total_inr, o.created_at, o.address_snapshot, o.tracking_number,
      o.carrier, o.tracking_url, u.email,
      coalesce(p.full_name, '') as customer_name,
      coalesce((select jsonb_agg(jsonb_build_object(
        'product_name', oi.product_name, 'variant_name', oi.variant_name,
        'sku', oi.sku, 'quantity', oi.quantity, 'line_total_inr', oi.line_total_inr
      )) from public.order_items oi where oi.order_id = o.id), '[]'::jsonb) as items,
      coalesce((select jsonb_agg(jsonb_build_object(
        'id', rr.id, 'status', rr.status, 'reason', rr.reason, 'created_at', rr.created_at
      )) from public.return_requests rr where rr.order_id = o.id), '[]'::jsonb) as return_requests,
      coalesce((select jsonb_agg(jsonb_build_object(
        'status', se.status, 'created_at', se.created_at) order by se.created_at
      ) from public.order_status_events se where se.order_id = o.id), '[]'::jsonb) as status_events
    from public.orders o join auth.users u on u.id = o.user_id
    left join public.profiles p on p.user_id = o.user_id
    where (p_status is null or o.status = p_status)
      and (nullif(trim(p_search), '') is null or
        o.order_number ilike '%' || trim(p_search) || '%' or
        u.email ilike '%' || trim(p_search) || '%')
    order by o.created_at desc limit p_limit offset p_offset
  ) page;
  return jsonb_build_object('total', v_total, 'orders', v_rows);
end;
$$;
revoke all on function public.admin_order_list(integer, integer, text, text) from public, anon;
grant execute on function public.admin_order_list(integer, integer, text, text) to authenticated;

create or replace function public.admin_customer_orders(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_orders jsonb;
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  if not exists (
    select 1 from auth.users u
    where u.id = p_user_id
      and not exists (select 1 from public.admin_users a where a.user_id = u.id)
  ) then raise exception 'Customer not found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', o.id, 'order_number', o.order_number, 'status', o.status,
    'payment_status', o.payment_status, 'payment_method', o.payment_method,
    'total_inr', o.total_inr, 'created_at', o.created_at
  ) order by o.created_at desc), '[]'::jsonb)
  into v_orders from public.orders o where o.user_id = p_user_id;
  return v_orders;
end;
$$;
revoke all on function public.admin_customer_orders(uuid) from public, anon;
grant execute on function public.admin_customer_orders(uuid) to authenticated;

create or replace function public.admin_save_store_settings(p_settings jsonb, p_content jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_ids uuid[];
  v_product_ids uuid[];
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  if jsonb_typeof(p_settings) <> 'object' or jsonb_typeof(p_content) <> 'object' then
    raise exception 'Invalid store settings';
  end if;
  if coalesce((p_settings ->> 'shipping_fee_inr')::numeric, -1) < 0
    or coalesce((p_settings ->> 'tax_rate_percent')::numeric, -1) not between 0 and 100
    or coalesce((p_settings ->> 'return_window_days')::integer, -1) not between 0 and 365
    or length(trim(p_settings ->> 'store_name')) not between 2 and 100 then
    raise exception 'Store settings are outside the allowed range';
  end if;
  if left(coalesce(p_content ->> 'hero_cta_url', ''), 1) <> '/'
    or left(coalesce(p_content ->> 'hero_cta_url', ''), 2) = '//' then
    raise exception 'CTA must use a local path';
  end if;
  if left(coalesce(p_content ->> 'promotion_cta_url', ''), 1) <> '/'
    or left(coalesce(p_content ->> 'promotion_cta_url', ''), 2) = '//' then
    raise exception 'Promotion CTA must use a local path';
  end if;
  if jsonb_typeof(p_content -> 'featured_category_ids') <> 'array'
    or jsonb_typeof(p_content -> 'featured_product_ids') <> 'array' then
    raise exception 'Featured selections must be arrays';
  end if;
  select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_category_ids
    from jsonb_array_elements_text(p_content -> 'featured_category_ids') as items(value);
  select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_product_ids
    from jsonb_array_elements_text(p_content -> 'featured_product_ids') as items(value);
  if exists (select 1 from unnest(v_category_ids) id
    where not exists (select 1 from public.categories c where c.id = id and c.is_active))
    or exists (select 1 from unnest(v_product_ids) id
    where not exists (select 1 from public.products p where p.id = id and p.status = 'published')) then
    raise exception 'Featured items must reference active categories and published products';
  end if;

  update public.store_settings set
    store_name = trim(p_settings ->> 'store_name'),
    cod_enabled = coalesce((p_settings ->> 'cod_enabled')::boolean, false),
    razorpay_enabled = coalesce((p_settings ->> 'razorpay_enabled')::boolean, false),
    shipping_fee_inr = (p_settings ->> 'shipping_fee_inr')::numeric,
    free_shipping_threshold_inr = nullif(p_settings ->> 'free_shipping_threshold_inr', '')::numeric,
    tax_rate_percent = (p_settings ->> 'tax_rate_percent')::numeric,
    support_email = coalesce(p_settings ->> 'support_email', ''),
    support_phone = coalesce(p_settings ->> 'support_phone', ''),
    return_window_days = (p_settings ->> 'return_window_days')::integer
  where id = true;
  insert into public.storefront_content (
    id, public_store_name, hero_headline, hero_description, hero_cta_label, hero_cta_url, hero_image_url,
    support_email, support_phone, return_policy, shipping_policy,
    return_window_days, featured_category_ids, featured_product_ids, promotion_headline, promotion_body,
    promotion_cta_label, promotion_cta_url, promotion_image_url
  ) values (
    true, trim(p_settings ->> 'store_name'), p_content ->> 'hero_headline', p_content ->> 'hero_description',
    p_content ->> 'hero_cta_label', p_content ->> 'hero_cta_url',
    nullif(p_content ->> 'hero_image_url', ''),
    coalesce(p_content ->> 'support_email', ''), coalesce(p_content ->> 'support_phone', ''),
    coalesce(p_content ->> 'return_policy', ''), coalesce(p_content ->> 'shipping_policy', ''),
    (p_settings ->> 'return_window_days')::integer, v_category_ids, v_product_ids,
    coalesce(p_content ->> 'promotion_headline', ''), coalesce(p_content ->> 'promotion_body', ''),
    coalesce(p_content ->> 'promotion_cta_label', 'Explore products'),
    coalesce(p_content ->> 'promotion_cta_url', '/products'),
    nullif(p_content ->> 'promotion_image_url', '')
  )
  on conflict (id) do update set
    public_store_name = excluded.public_store_name,
    hero_headline = excluded.hero_headline,
    hero_description = excluded.hero_description,
    hero_cta_label = excluded.hero_cta_label,
    hero_cta_url = excluded.hero_cta_url,
    hero_image_url = excluded.hero_image_url,
    support_email = excluded.support_email,
    support_phone = excluded.support_phone,
    return_policy = excluded.return_policy,
    shipping_policy = excluded.shipping_policy,
    return_window_days = excluded.return_window_days,
    featured_category_ids = excluded.featured_category_ids,
    featured_product_ids = excluded.featured_product_ids,
    promotion_headline = excluded.promotion_headline,
    promotion_body = excluded.promotion_body,
    promotion_cta_label = excluded.promotion_cta_label,
    promotion_cta_url = excluded.promotion_cta_url,
    promotion_image_url = excluded.promotion_image_url;
end;
$$;
revoke all on function public.admin_save_store_settings(jsonb, jsonb) from public, anon;
grant execute on function public.admin_save_store_settings(jsonb, jsonb) to authenticated;

create or replace function public.admin_update_payment_refund(p_payment_id uuid, p_verified_provider_payment_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_store_admin() then raise exception 'Administrator access required'; end if;
  raise exception 'Refund status can only be changed by verified payment-provider reconciliation; no provider refund integration is configured';
end;
$$;
revoke all on function public.admin_update_payment_refund(uuid, text) from public, anon;
grant execute on function public.admin_update_payment_refund(uuid, text) to authenticated;
