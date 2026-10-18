create table if not exists public.store_settings (
  id boolean primary key default true check (id),
  cod_enabled boolean not null default false,
  razorpay_enabled boolean not null default false,
  shipping_fee_inr numeric(12, 2) not null default 0 check (shipping_fee_inr >= 0),
  free_shipping_threshold_inr numeric(12, 2) check (
    free_shipping_threshold_inr is null or free_shipping_threshold_inr >= 0
  ),
  tax_rate_percent numeric(5, 2) not null default 0 check (tax_rate_percent between 0 and 100),
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  recipient_name text not null check (length(trim(recipient_name)) between 2 and 100),
  phone text not null check (phone ~ '^[6-9][0-9]{9}$'),
  line1 text not null check (length(trim(line1)) between 3 and 200),
  line2 text not null default '' check (length(line2) <= 200),
  city text not null check (length(trim(city)) between 2 and 100),
  state text not null check (length(trim(state)) between 2 and 100),
  pin_code text not null check (pin_code ~ '^[1-9][0-9]{5}$'),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists addresses_one_default_per_user_idx
  on public.addresses (user_id) where is_default;
create index if not exists addresses_user_created_idx
  on public.addresses (user_id, created_at desc);

create table if not exists public.carts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cart_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  quantity integer not null check (quantity between 1 and 99),
  updated_at timestamptz not null default now(),
  primary key (user_id, variant_id)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(trim(code)) and length(code) between 3 and 40),
  discount_type text not null check (discount_type in ('percent', 'fixed')),
  discount_value numeric(12, 2) not null check (discount_value > 0),
  minimum_subtotal_inr numeric(12, 2) not null default 0 check (minimum_subtotal_inr >= 0),
  maximum_discount_inr numeric(12, 2) check (maximum_discount_inr is null or maximum_discount_inr >= 0),
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_user_limit integer not null default 1 check (per_user_limit > 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  check (discount_type <> 'percent' or discount_value <= 100),
  check (expires_at is null or expires_at > starts_at)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  checkout_key uuid not null,
  checkout_fingerprint text not null,
  status text not null check (status in ('pending_payment', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  payment_status text not null check (payment_status in ('pending', 'paid', 'due_on_delivery', 'failed', 'refunded')),
  payment_method text not null check (payment_method in ('cod', 'razorpay')),
  address_snapshot jsonb not null check (jsonb_typeof(address_snapshot) = 'object'),
  subtotal_inr numeric(12, 2) not null check (subtotal_inr >= 0),
  discount_inr numeric(12, 2) not null default 0 check (discount_inr >= 0),
  shipping_inr numeric(12, 2) not null default 0 check (shipping_inr >= 0),
  tax_inr numeric(12, 2) not null default 0 check (tax_inr >= 0),
  total_inr numeric(12, 2) not null check (total_inr >= 0),
  coupon_id uuid references public.coupons(id) on delete set null,
  coupon_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_user_created_idx on public.orders (user_id, created_at desc);
create unique index if not exists orders_user_checkout_key_idx on public.orders (user_id, checkout_key);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  product_name text not null,
  variant_name text not null,
  sku text not null,
  unit_price_inr numeric(12, 2) not null check (unit_price_inr > 0),
  quantity integer not null check (quantity between 1 and 99),
  line_total_inr numeric(12, 2) not null check (line_total_inr > 0),
  created_at timestamptz not null default now(),
  unique (order_id, variant_id)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  method text not null check (method in ('cod', 'razorpay')),
  status text not null check (status in ('pending', 'paid', 'due_on_delivery', 'failed', 'refunded')),
  amount_inr numeric(12, 2) not null check (amount_inr >= 0),
  razorpay_order_id text unique,
  provider_payment_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  order_id uuid not null unique references public.orders(id) on delete cascade,
  discount_inr numeric(12, 2) not null check (discount_inr >= 0),
  status text not null default 'reserved' check (status in ('reserved', 'redeemed')),
  created_at timestamptz not null default now(),
  unique (coupon_id, user_id, order_id)
);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  quantity_change integer not null check (quantity_change <> 0),
  reason text not null check (reason in ('order_reserved', 'reservation_released')),
  created_at timestamptz not null default now()
);

create index if not exists coupon_redemptions_coupon_user_idx
  on public.coupon_redemptions (coupon_id, user_id);
create index if not exists inventory_movements_variant_created_idx
  on public.inventory_movements (variant_id, created_at desc);

drop trigger if exists addresses_set_updated_at on public.addresses;
create trigger addresses_set_updated_at before update on public.addresses
for each row execute function public.set_catalog_updated_at();
drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at before update on public.store_settings
for each row execute function public.set_catalog_updated_at();
drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at before update on public.orders
for each row execute function public.set_catalog_updated_at();
drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at before update on public.payments
for each row execute function public.set_catalog_updated_at();

alter table public.store_settings enable row level security;
alter table public.addresses enable row level security;
alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payments enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.inventory_movements enable row level security;

grant select, insert, update, delete on public.addresses to authenticated;
grant select on public.carts, public.cart_items, public.orders, public.order_items,
  public.payments, public.coupon_redemptions to authenticated;

drop policy if exists "Customers manage own addresses" on public.addresses;
create policy "Customers manage own addresses" on public.addresses
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Customers read own carts" on public.carts;
create policy "Customers read own carts" on public.carts
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Customers read own cart items" on public.cart_items;
create policy "Customers read own cart items" on public.cart_items
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Customers read own orders" on public.orders;
create policy "Customers read own orders" on public.orders
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Customers read own order items" on public.order_items;
create policy "Customers read own order items" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.orders o where o.id = order_id and o.user_id = (select auth.uid()))
  );
drop policy if exists "Customers read own payments" on public.payments;
create policy "Customers read own payments" on public.payments
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Customers read own coupon redemptions" on public.coupon_redemptions;
create policy "Customers read own coupon redemptions" on public.coupon_redemptions
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.store_settings, public.coupons, public.inventory_movements from anon, authenticated;
revoke insert, update, delete on public.carts, public.cart_items, public.orders,
  public.order_items, public.payments, public.coupon_redemptions from anon, authenticated;

create or replace function public.get_checkout_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'cod_enabled', s.cod_enabled,
    'razorpay_enabled', s.razorpay_enabled,
    'shipping_fee_inr', s.shipping_fee_inr,
    'free_shipping_threshold_inr', s.free_shipping_threshold_inr,
    'tax_rate_percent', s.tax_rate_percent
  )
  from public.store_settings s where s.id
$$;
revoke all on function public.get_checkout_config() from public;
grant execute on function public.get_checkout_config() to anon, authenticated;

create or replace function public.merge_guest_cart(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item record;
  v_stock integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'Invalid cart';
  end if;

  insert into public.carts (user_id) values (v_user_id) on conflict (user_id) do nothing;
  for v_item in
    select rows.variant_id, sum(rows.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as rows(variant_id uuid, quantity integer)
    group by rows.variant_id order by rows.variant_id
  loop
    if v_item.quantity < 1 or v_item.quantity > 9900 then raise exception 'Invalid quantity'; end if;
    select pv.stock_quantity into v_stock
    from public.product_variants pv
    join public.products p on p.id = pv.product_id and p.status = 'published'
    join public.categories c on c.id = p.category_id and c.is_active
    where pv.id = v_item.variant_id and pv.is_active
    for update of pv;
    if not found or v_stock < 1 then continue; end if;
    insert into public.cart_items (user_id, variant_id, quantity)
    values (v_user_id, v_item.variant_id, least(v_stock, v_item.quantity, 99))
    on conflict (user_id, variant_id) do update
      set quantity = least(v_stock, public.cart_items.quantity + excluded.quantity, 99),
          updated_at = now();
  end loop;
end;
$$;
revoke all on function public.merge_guest_cart(jsonb) from public, anon;
grant execute on function public.merge_guest_cart(jsonb) to authenticated;

create or replace function public.save_customer_address(
  p_address_id uuid,
  p_recipient_name text,
  p_phone text,
  p_line1 text,
  p_line2 text,
  p_city text,
  p_state text,
  p_pin_code text,
  p_is_default boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_address_id uuid := coalesce(p_address_id, gen_random_uuid());
  v_has_addresses boolean;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if length(trim(p_recipient_name)) not between 2 and 100
    or p_phone !~ '^[6-9][0-9]{9}$'
    or length(trim(p_line1)) not between 3 and 200
    or length(coalesce(p_line2, '')) > 200
    or length(trim(p_city)) not between 2 and 100
    or length(trim(p_state)) not between 2 and 100
    or p_pin_code !~ '^[1-9][0-9]{5}$' then
    raise exception 'Address fields are invalid';
  end if;
  if p_address_id is not null and not exists (
    select 1 from public.addresses where id = p_address_id and user_id = v_user_id
  ) then raise exception 'Address not found'; end if;
  select exists (select 1 from public.addresses where user_id = v_user_id) into v_has_addresses;
  if coalesce(p_is_default, false) or not v_has_addresses then
    update public.addresses set is_default = false
    where user_id = v_user_id and is_default and id <> v_address_id;
  end if;
  if p_address_id is null then
    insert into public.addresses (
      id, user_id, recipient_name, phone, line1, line2, city, state, pin_code, is_default
    ) values (
      v_address_id, v_user_id, trim(p_recipient_name), p_phone, trim(p_line1),
      coalesce(trim(p_line2), ''), trim(p_city), trim(p_state), p_pin_code,
      coalesce(p_is_default, false) or not v_has_addresses
    );
  else
    update public.addresses set recipient_name = trim(p_recipient_name), phone = p_phone,
      line1 = trim(p_line1), line2 = coalesce(trim(p_line2), ''), city = trim(p_city),
      state = trim(p_state), pin_code = p_pin_code,
      is_default = coalesce(p_is_default, false)
    where id = v_address_id and user_id = v_user_id;
  end if;
  return v_address_id;
end;
$$;
revoke all on function public.save_customer_address(uuid, text, text, text, text, text, text, text, boolean) from public, anon;
grant execute on function public.save_customer_address(uuid, text, text, text, text, text, text, text, boolean) to authenticated;

create or replace function public.sync_cart_items(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item record;
  v_stock integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 100 then
    raise exception 'Invalid cart';
  end if;
  insert into public.carts (user_id) values (v_user_id) on conflict (user_id) do nothing;
  delete from public.cart_items where user_id = v_user_id;
  for v_item in
    select rows.variant_id, sum(rows.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as rows(variant_id uuid, quantity integer)
    group by rows.variant_id order by rows.variant_id
  loop
    if v_item.quantity < 1 or v_item.quantity > 99 then raise exception 'Invalid quantity'; end if;
    select pv.stock_quantity into v_stock
    from public.product_variants pv
    join public.products p on p.id = pv.product_id and p.status = 'published'
    join public.categories c on c.id = p.category_id and c.is_active
    where pv.id = v_item.variant_id and pv.is_active
    for update of pv;
    if found and v_stock > 0 then
      insert into public.cart_items (user_id, variant_id, quantity)
      values (v_user_id, v_item.variant_id, least(v_stock, v_item.quantity, 99));
    end if;
  end loop;
  update public.carts set updated_at = now() where user_id = v_user_id;
end;
$$;
revoke all on function public.sync_cart_items(jsonb) from public, anon;
grant execute on function public.sync_cart_items(jsonb) to authenticated;

create or replace function public.preview_checkout(p_items jsonb, p_coupon_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item record;
  v_stock integer;
  v_price numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_shipping numeric(12,2);
  v_tax numeric(12,2);
  v_total numeric(12,2);
  v_settings public.store_settings%rowtype;
  v_coupon public.coupons%rowtype;
  v_coupon_id uuid;
  v_coupon_code text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 40 then
    raise exception 'Cart is empty or invalid';
  end if;
  select * into v_settings from public.store_settings where id;
  for v_item in
    select rows.variant_id, sum(rows.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as rows(variant_id uuid, quantity integer)
    group by rows.variant_id order by rows.variant_id
  loop
    if v_item.quantity < 1 or v_item.quantity > 99 then raise exception 'Invalid quantity'; end if;
    select pv.stock_quantity, coalesce(pv.price_inr, p.price_inr)
      into v_stock, v_price
    from public.product_variants pv
    join public.products p on p.id = pv.product_id and p.status = 'published'
    join public.categories c on c.id = p.category_id and c.is_active
    where pv.id = v_item.variant_id and pv.is_active;
    if not found then raise exception 'A cart item is no longer available'; end if;
    if v_stock < v_item.quantity then raise exception 'A cart item exceeds available stock'; end if;
    v_subtotal := v_subtotal + v_price * v_item.quantity;
  end loop;

  if nullif(trim(p_coupon_code), '') is not null then
    select * into v_coupon from public.coupons
    where code = upper(trim(p_coupon_code)) and is_active
      and starts_at <= now() and (expires_at is null or expires_at > now());
    if not found then raise exception 'Coupon code is invalid or expired'; end if;
    if v_subtotal < v_coupon.minimum_subtotal_inr then raise exception 'Cart does not meet this coupon minimum'; end if;
    if v_coupon.usage_limit is not null and
      (select count(*) from public.coupon_redemptions where coupon_id = v_coupon.id) >= v_coupon.usage_limit then
      raise exception 'Coupon usage limit has been reached';
    end if;
    if (select count(*) from public.coupon_redemptions
        where coupon_id = v_coupon.id and user_id = v_user_id) >= v_coupon.per_user_limit then
      raise exception 'You have already used this coupon';
    end if;
    v_discount := case when v_coupon.discount_type = 'percent'
      then round(v_subtotal * v_coupon.discount_value / 100, 2)
      else least(v_subtotal, v_coupon.discount_value) end;
    if v_coupon.maximum_discount_inr is not null then
      v_discount := least(v_discount, v_coupon.maximum_discount_inr);
    end if;
    v_coupon_id := v_coupon.id;
    v_coupon_code := v_coupon.code;
  end if;
  v_shipping := case
    when v_settings.free_shipping_threshold_inr is not null
      and v_subtotal - v_discount >= v_settings.free_shipping_threshold_inr then 0
    else v_settings.shipping_fee_inr
  end;
  v_tax := round((v_subtotal - v_discount) * v_settings.tax_rate_percent / 100, 2);
  v_total := v_subtotal - v_discount + v_shipping + v_tax;
  return jsonb_build_object(
    'subtotal_inr', v_subtotal, 'discount_inr', v_discount, 'shipping_inr', v_shipping,
    'tax_inr', v_tax, 'total_inr', v_total, 'coupon_id', v_coupon_id,
    'coupon_code', v_coupon_code, 'tax_rate_percent', v_settings.tax_rate_percent
  );
end;
$$;
revoke all on function public.preview_checkout(jsonb, text) from public, anon;
grant execute on function public.preview_checkout(jsonb, text) to authenticated;

create or replace function public.place_checkout_order(
  p_address_id uuid,
  p_checkout_key uuid,
  p_payment_method text,
  p_items jsonb,
  p_coupon_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_item record;
  v_variant record;
  v_address public.addresses%rowtype;
  v_existing_order public.orders%rowtype;
  v_settings public.store_settings%rowtype;
  v_coupon public.coupons%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_shipping numeric(12,2);
  v_tax numeric(12,2);
  v_total numeric(12,2);
  v_line_total numeric(12,2);
  v_coupon_id uuid;
  v_coupon_code text;
  v_redemptions integer;
  v_checkout_fingerprint text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_checkout_key is null then raise exception 'Checkout request key is required'; end if;
  if p_payment_method not in ('cod', 'razorpay') then raise exception 'Unsupported payment method'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 40 then
    raise exception 'Cart is empty or invalid';
  end if;
  v_checkout_fingerprint := md5(
    p_address_id::text || '|' || p_payment_method || '|' || p_items::text || '|' || coalesce(p_coupon_code, '')
  );
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || p_checkout_key::text, 0));
  select * into v_existing_order from public.orders
    where user_id = v_user_id and checkout_key = p_checkout_key;
  if found then
    if v_existing_order.checkout_fingerprint <> v_checkout_fingerprint then
      raise exception 'This checkout key was already used with different order details';
    end if;
    return jsonb_build_object(
      'id', v_existing_order.id, 'order_number', v_existing_order.order_number,
      'status', v_existing_order.status, 'payment_status', v_existing_order.payment_status,
      'payment_method', v_existing_order.payment_method, 'subtotal_inr', v_existing_order.subtotal_inr,
      'discount_inr', v_existing_order.discount_inr, 'shipping_inr', v_existing_order.shipping_inr,
      'tax_inr', v_existing_order.tax_inr, 'total_inr', v_existing_order.total_inr
    );
  end if;
  if exists (
    select 1 from public.orders
    where user_id = v_user_id and status = 'pending_payment'
  ) then
    raise exception 'You have an online payment awaiting confirmation. Check its order status before placing another order.';
  end if;
  select * into v_address from public.addresses where id = p_address_id and user_id = v_user_id;
  if not found then raise exception 'Choose a saved shipping address'; end if;
  select * into v_settings from public.store_settings where id for share;
  if p_payment_method = 'cod' and not v_settings.cod_enabled then raise exception 'Cash on Delivery is not available'; end if;
  if p_payment_method = 'razorpay' and not v_settings.razorpay_enabled then raise exception 'Online payment is not available'; end if;

  if nullif(trim(p_coupon_code), '') is not null then
    select * into v_coupon from public.coupons
    where code = upper(trim(p_coupon_code)) and is_active
      and starts_at <= now() and (expires_at is null or expires_at > now())
    for update;
    if not found then raise exception 'Coupon code is invalid or expired'; end if;
  end if;

  for v_item in
    select rows.variant_id, sum(rows.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as rows(variant_id uuid, quantity integer)
    group by rows.variant_id order by rows.variant_id
  loop
    if v_item.quantity < 1 or v_item.quantity > 99 then raise exception 'Invalid quantity'; end if;
    select pv.id, pv.product_id, pv.sku, pv.name as variant_name, pv.stock_quantity,
      coalesce(pv.price_inr, p.price_inr) as unit_price, p.name as product_name
      into v_variant
    from public.product_variants pv
    join public.products p on p.id = pv.product_id and p.status = 'published'
    join public.categories c on c.id = p.category_id and c.is_active
    where pv.id = v_item.variant_id and pv.is_active
    for update of pv;
    if not found then raise exception 'A cart item is no longer available'; end if;
    if v_variant.stock_quantity < v_item.quantity then raise exception 'A cart item exceeds available stock'; end if;
    v_subtotal := v_subtotal + v_variant.unit_price * v_item.quantity;
  end loop;

  if v_coupon.id is not null then
    if v_subtotal < v_coupon.minimum_subtotal_inr then raise exception 'Cart does not meet this coupon minimum'; end if;
    select count(*) into v_redemptions from public.coupon_redemptions where coupon_id = v_coupon.id;
    if v_coupon.usage_limit is not null and v_redemptions >= v_coupon.usage_limit then raise exception 'Coupon usage limit has been reached'; end if;
    select count(*) into v_redemptions from public.coupon_redemptions
      where coupon_id = v_coupon.id and user_id = v_user_id;
    if v_redemptions >= v_coupon.per_user_limit then raise exception 'You have already used this coupon'; end if;
    v_discount := case when v_coupon.discount_type = 'percent'
      then round(v_subtotal * v_coupon.discount_value / 100, 2)
      else least(v_subtotal, v_coupon.discount_value) end;
    if v_coupon.maximum_discount_inr is not null then v_discount := least(v_discount, v_coupon.maximum_discount_inr); end if;
    v_coupon_id := v_coupon.id;
    v_coupon_code := v_coupon.code;
  end if;

  v_shipping := case
    when v_settings.free_shipping_threshold_inr is not null
      and v_subtotal - v_discount >= v_settings.free_shipping_threshold_inr then 0
    else v_settings.shipping_fee_inr
  end;
  v_tax := round((v_subtotal - v_discount) * v_settings.tax_rate_percent / 100, 2);
  v_total := v_subtotal - v_discount + v_shipping + v_tax;
  v_order_number := 'SB-' || to_char(now() at time zone 'UTC', 'YYYYMMDD') || '-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 8));

  insert into public.orders (
    id, order_number, user_id, checkout_key, checkout_fingerprint,
    status, payment_status, payment_method, address_snapshot,
    subtotal_inr, discount_inr, shipping_inr, tax_inr, total_inr, coupon_id, coupon_code
  ) values (
    v_order_id, v_order_number, v_user_id, p_checkout_key, v_checkout_fingerprint,
    case when p_payment_method = 'cod' then 'confirmed' else 'pending_payment' end,
    case when p_payment_method = 'cod' then 'due_on_delivery' else 'pending' end,
    p_payment_method,
    jsonb_build_object('recipient_name', v_address.recipient_name, 'phone', v_address.phone,
      'line1', v_address.line1, 'line2', v_address.line2, 'city', v_address.city,
      'state', v_address.state, 'pin_code', v_address.pin_code),
    v_subtotal, v_discount, v_shipping, v_tax, v_total, v_coupon_id, v_coupon_code
  );

  for v_item in
    select rows.variant_id, sum(rows.quantity)::integer as quantity
    from jsonb_to_recordset(p_items) as rows(variant_id uuid, quantity integer)
    group by rows.variant_id order by rows.variant_id
  loop
    select pv.id, pv.product_id, pv.sku, pv.name as variant_name, pv.stock_quantity,
      coalesce(pv.price_inr, p.price_inr) as unit_price, p.name as product_name
      into v_variant
    from public.product_variants pv join public.products p on p.id = pv.product_id
    where pv.id = v_item.variant_id
    for update of pv;
    v_line_total := v_variant.unit_price * v_item.quantity;
    update public.product_variants set stock_quantity = stock_quantity - v_item.quantity where id = v_item.variant_id;
    insert into public.order_items (
      order_id, product_id, variant_id, product_name, variant_name, sku, unit_price_inr, quantity, line_total_inr
    ) values (
      v_order_id, v_variant.product_id, v_variant.id, v_variant.product_name, v_variant.variant_name,
      v_variant.sku, v_variant.unit_price, v_item.quantity, v_line_total
    );
    insert into public.inventory_movements (variant_id, order_id, quantity_change, reason)
      values (v_variant.id, v_order_id, -v_item.quantity, 'order_reserved');
  end loop;

  insert into public.payments (order_id, user_id, method, status, amount_inr)
  values (v_order_id, v_user_id, p_payment_method,
    case when p_payment_method = 'cod' then 'due_on_delivery' else 'pending' end, v_total);
  if v_coupon_id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id, discount_inr, status)
      values (v_coupon_id, v_user_id, v_order_id, v_discount,
        case when p_payment_method = 'cod' then 'redeemed' else 'reserved' end);
  end if;
  delete from public.cart_items where user_id = v_user_id;
  return jsonb_build_object(
    'id', v_order_id, 'order_number', v_order_number, 'status',
    case when p_payment_method = 'cod' then 'confirmed' else 'pending_payment' end,
    'payment_status', case when p_payment_method = 'cod' then 'due_on_delivery' else 'pending' end,
    'payment_method', p_payment_method, 'subtotal_inr', v_subtotal, 'discount_inr', v_discount,
    'shipping_inr', v_shipping, 'tax_inr', v_tax, 'total_inr', v_total
  );
end;
$$;
revoke all on function public.place_checkout_order(uuid, uuid, text, jsonb, text) from public, anon;
grant execute on function public.place_checkout_order(uuid, uuid, text, jsonb, text) to authenticated;

create or replace function public.cancel_pending_checkout(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_order public.orders%rowtype;
  v_line record;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select * into v_order from public.orders where id = p_order_id and user_id = v_user_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status <> 'pending_payment' then return; end if;
  if exists (
    select 1 from public.payments
    where order_id = p_order_id and razorpay_order_id is not null
  ) then
    raise exception 'A Razorpay payment session has already been issued; its status must be verified before cancellation';
  end if;
  for v_line in select variant_id, quantity from public.order_items where order_id = p_order_id loop
    update public.product_variants set stock_quantity = stock_quantity + v_line.quantity where id = v_line.variant_id;
    insert into public.inventory_movements (variant_id, order_id, quantity_change, reason)
      values (v_line.variant_id, p_order_id, v_line.quantity, 'reservation_released');
  end loop;
  update public.orders set status = 'cancelled', payment_status = 'failed' where id = p_order_id;
  update public.payments set status = 'failed' where order_id = p_order_id and status = 'pending';
  delete from public.coupon_redemptions where order_id = p_order_id and status = 'reserved';
end;
$$;
revoke all on function public.cancel_pending_checkout(uuid) from public, anon;
grant execute on function public.cancel_pending_checkout(uuid) to authenticated;

create or replace function public.attach_razorpay_order(p_order_id uuid, p_razorpay_order_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_existing_order text;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  select razorpay_order_id into v_existing_order
    from public.payments
    where order_id = p_order_id and user_id = v_user_id and method = 'razorpay' and status = 'pending'
    for update;
  if not found then raise exception 'Pending payment not found'; end if;
  if v_existing_order is not null then
    if v_existing_order <> p_razorpay_order_id then raise exception 'A payment session already exists for this order'; end if;
    return;
  end if;
  update public.payments set razorpay_order_id = p_razorpay_order_id
    where order_id = p_order_id and user_id = v_user_id;
end;
$$;
revoke all on function public.attach_razorpay_order(uuid, text) from public, anon;
grant execute on function public.attach_razorpay_order(uuid, text) to authenticated;

create or replace function public.confirm_razorpay_payment(p_order_id uuid, p_provider_payment_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  update public.payments set status = 'paid', provider_payment_id = p_provider_payment_id
  where order_id = p_order_id and user_id = v_user_id and method = 'razorpay' and status = 'pending';
  if not found then
    if exists (
      select 1 from public.payments where order_id = p_order_id and user_id = v_user_id
        and method = 'razorpay' and status = 'paid' and provider_payment_id = p_provider_payment_id
    ) then return; end if;
    raise exception 'Pending payment not found';
  end if;
  update public.orders set status = 'confirmed', payment_status = 'paid'
    where id = p_order_id and user_id = v_user_id and status = 'pending_payment';
  if not found then raise exception 'Order is no longer awaiting payment'; end if;
  update public.coupon_redemptions set status = 'redeemed' where order_id = p_order_id;
end;
$$;
revoke all on function public.confirm_razorpay_payment(uuid, text) from public, anon;
grant execute on function public.confirm_razorpay_payment(uuid, text) to authenticated;

create or replace function public.confirm_razorpay_webhook(
  p_razorpay_order_id text,
  p_provider_payment_id text,
  p_amount_paise bigint,
  p_currency text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid;
begin
  update public.payments set status = 'paid', provider_payment_id = p_provider_payment_id
    where razorpay_order_id = p_razorpay_order_id and method = 'razorpay' and status = 'pending'
      and round(amount_inr * 100) = p_amount_paise and p_currency = 'INR'
    returning order_id into v_order_id;
  if v_order_id is null then return; end if;
  update public.orders set status = 'confirmed', payment_status = 'paid'
    where id = v_order_id and status = 'pending_payment';
  update public.coupon_redemptions set status = 'redeemed' where order_id = v_order_id;
end;
$$;
revoke all on function public.confirm_razorpay_webhook(text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.confirm_razorpay_webhook(text, text, bigint, text) to service_role;
