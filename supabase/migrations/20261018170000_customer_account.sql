create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (length(trim(full_name)) between 0 and 100),
  phone text not null default '' check (phone = '' or phone ~ '^[6-9][0-9]{9}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlists (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wishlist_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  order_updates boolean not null default true,
  security_alerts boolean not null default true,
  promotions boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid references public.orders(id) on delete cascade,
  event_type text not null check (event_type in ('order_confirmed', 'order_processing', 'order_shipped', 'order_delivered', 'return_requested')),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table if not exists public.return_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  reason text not null check (length(trim(reason)) between 10 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'received', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, order_id)
);

create table if not exists public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending_payment', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.orders
  add column if not exists carrier text,
  add column if not exists tracking_number text,
  add column if not exists tracking_url text,
  add column if not exists confirmed_at timestamptz,
  add column if not exists processing_at timestamptz,
  add column if not exists shipped_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists cancelled_at timestamptz;

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('pending', 'paid', 'due_on_delivery', 'failed', 'refunded', 'cancelled'));
alter table public.payments drop constraint if exists payments_status_check;
alter table public.payments add constraint payments_status_check
  check (status in ('pending', 'paid', 'due_on_delivery', 'failed', 'refunded', 'cancelled'));

create index if not exists wishlist_items_user_created_idx
  on public.wishlist_items (user_id, created_at desc);
create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);
create index if not exists return_requests_user_created_idx
  on public.return_requests (user_id, created_at desc);
create index if not exists order_status_events_order_created_idx
  on public.order_status_events (order_id, created_at);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
for each row execute function public.set_catalog_updated_at();
drop trigger if exists wishlists_set_updated_at on public.wishlists;
create trigger wishlists_set_updated_at before update on public.wishlists
for each row execute function public.set_catalog_updated_at();
drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at before update on public.notification_preferences
for each row execute function public.set_catalog_updated_at();
drop trigger if exists return_requests_set_updated_at on public.return_requests;
create trigger return_requests_set_updated_at before update on public.return_requests
for each row execute function public.set_catalog_updated_at();

alter table public.profiles enable row level security;
alter table public.wishlists enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.return_requests enable row level security;
alter table public.order_status_events enable row level security;

grant select on public.profiles, public.wishlists, public.wishlist_items,
  public.notification_preferences, public.notifications, public.return_requests,
  public.order_status_events to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select on public.return_requests to authenticated;
revoke insert, update, delete on public.wishlists, public.wishlist_items,
  public.notifications, public.return_requests from anon, authenticated;

drop policy if exists "Customers read own profile" on public.profiles;
create policy "Customers read own profile" on public.profiles
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Customers update permitted profile fields" on public.profiles;
create policy "Customers update permitted profile fields" on public.profiles
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "Customers read own wishlist" on public.wishlists;
create policy "Customers read own wishlist" on public.wishlists
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Customers read own wishlist items" on public.wishlist_items;
create policy "Customers read own wishlist items" on public.wishlist_items
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Customers manage own notification preferences" on public.notification_preferences;
create policy "Customers manage own notification preferences" on public.notification_preferences
  for all to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists "Customers read own notifications" on public.notifications;
create policy "Customers read own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Customers read own return requests" on public.return_requests;
create policy "Customers read own return requests" on public.return_requests
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Customers read own order status events" on public.order_status_events;
create policy "Customers read own order status events" on public.order_status_events
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Customers read their own reviews" on public.reviews;
create policy "Customers read their own reviews" on public.reviews
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists "Customers can submit pending reviews for themselves" on public.reviews;
drop policy if exists "Verified customers can submit pending reviews" on public.reviews;
create policy "Verified customers can submit pending reviews"
  on public.reviews for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1
      from public.order_items oi
      join public.orders o on o.id = oi.order_id
      where oi.product_id = reviews.product_id
        and o.user_id = (select auth.uid())
        and o.status = 'delivered'
    )
  );

create or replace function public.provision_customer_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''))
  on conflict (user_id) do nothing;
  insert into public.wishlists (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.notification_preferences (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function public.provision_customer_account() from public, anon, authenticated;
drop trigger if exists auth_user_provision_customer_account on auth.users;
create trigger auth_user_provision_customer_account
  after insert on auth.users
  for each row execute function public.provision_customer_account();

insert into public.profiles (user_id, full_name)
select u.id, coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name', '')
from auth.users u on conflict (user_id) do nothing;
insert into public.wishlists (user_id)
select u.id from auth.users u on conflict (user_id) do nothing;
insert into public.notification_preferences (user_id)
select u.id from auth.users u on conflict (user_id) do nothing;

create or replace function public.sync_customer_wishlist(p_product_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if coalesce(array_length(p_product_ids, 1), 0) > 100 then raise exception 'Wishlist is too large'; end if;
  insert into public.wishlists (user_id) values (v_user_id) on conflict (user_id) do nothing;
  delete from public.wishlist_items
  where user_id = v_user_id
    and product_id <> all(coalesce(p_product_ids, '{}'::uuid[]));
  insert into public.wishlist_items (user_id, product_id)
  select v_user_id, requested.id
  from (select distinct unnest(coalesce(p_product_ids, '{}'::uuid[])) as id) requested
  join public.products p on p.id = requested.id and p.status = 'published'
  join public.categories c on c.id = p.category_id and c.is_active
  on conflict (user_id, product_id) do nothing;
end;
$$;
revoke all on function public.sync_customer_wishlist(uuid[]) from public, anon;
grant execute on function public.sync_customer_wishlist(uuid[]) to authenticated;

create or replace function public.mark_customer_notification_read(p_notification_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  update public.notifications set read_at = coalesce(read_at, now())
  where id = p_notification_id and user_id = auth.uid();
  if not found then raise exception 'Notification not found'; end if;
end;
$$;
revoke all on function public.mark_customer_notification_read(uuid) from public, anon;
grant execute on function public.mark_customer_notification_read(uuid) to authenticated;

create or replace function public.cancel_customer_cod_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_line record;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select * into v_order from public.orders
  where id = p_order_id and user_id = auth.uid() for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status <> 'confirmed'
    or v_order.payment_method <> 'cod'
    or v_order.payment_status <> 'due_on_delivery' then
    raise exception 'This order can no longer be cancelled online';
  end if;
  for v_line in select variant_id, quantity from public.order_items where order_id = p_order_id loop
    update public.product_variants set stock_quantity = stock_quantity + v_line.quantity
    where id = v_line.variant_id;
    insert into public.inventory_movements (variant_id, order_id, quantity_change, reason)
    values (v_line.variant_id, p_order_id, v_line.quantity, 'reservation_released');
  end loop;
  update public.orders set status = 'cancelled', payment_status = 'cancelled', cancelled_at = now()
  where id = p_order_id;
  update public.payments set status = 'cancelled'
  where order_id = p_order_id and status = 'due_on_delivery';
end;
$$;
revoke all on function public.cancel_customer_cod_order(uuid) from public, anon;
grant execute on function public.cancel_customer_cod_order(uuid) to authenticated;

create or replace function public.request_customer_return(p_order_id uuid, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_request_id uuid;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if length(trim(p_reason)) not between 10 and 1000 then raise exception 'Please provide a return reason between 10 and 1000 characters'; end if;
  if not exists (
    select 1 from public.orders
    where id = p_order_id and user_id = v_user_id
      and status = 'delivered' and delivered_at >= now() - interval '30 days'
  ) then raise exception 'Returns can only be requested within 30 days of delivery'; end if;
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
        and o.delivered_at >= now() - interval '30 days'
        and not exists (
          select 1 from public.return_requests rr
          where rr.order_id = o.id and rr.user_id = auth.uid()
        )
    )
$$;
revoke all on function public.can_request_customer_return(uuid) from public, anon;
grant execute on function public.can_request_customer_return(uuid) to authenticated;

create or replace function public.record_order_status_timestamps()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'confirmed' and new.confirmed_at is null then new.confirmed_at := now(); end if;
  if new.status = 'processing' and new.processing_at is null then new.processing_at := now(); end if;
  if new.status = 'shipped' and new.shipped_at is null then new.shipped_at := now(); end if;
  if new.status = 'delivered' and new.delivered_at is null then new.delivered_at := now(); end if;
  if new.status = 'cancelled' and new.cancelled_at is null then new.cancelled_at := now(); end if;
  return new;
end;
$$;
drop trigger if exists orders_record_status_timestamps on public.orders;
drop trigger if exists orders_record_insert_status_timestamps on public.orders;
create trigger orders_record_insert_status_timestamps before insert on public.orders
for each row execute function public.record_order_status_timestamps();
create trigger orders_record_status_timestamps before update of status on public.orders
for each row execute function public.record_order_status_timestamps();

create or replace function public.record_customer_order_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.status = old.status then return new; end if;
  end if;
  insert into public.order_status_events (order_id, user_id, status)
  values (new.id, new.user_id, new.status);
  return new;
end;
$$;
revoke all on function public.record_customer_order_status_event() from public, anon, authenticated;
drop trigger if exists orders_record_customer_status_event on public.orders;
drop trigger if exists orders_record_insert_customer_status_event on public.orders;
create trigger orders_record_insert_customer_status_event after insert on public.orders
for each row execute function public.record_customer_order_status_event();
create trigger orders_record_customer_status_event after update of status on public.orders
for each row execute function public.record_customer_order_status_event();

create or replace function public.create_customer_order_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event text;
  v_title text;
  v_body text;
  v_enabled boolean;
begin
  if tg_op = 'UPDATE' then
    if new.status = old.status then return new; end if;
  end if;
  v_event := case new.status
    when 'confirmed' then 'order_confirmed'
    when 'processing' then 'order_processing'
    when 'shipped' then 'order_shipped'
    when 'delivered' then 'order_delivered'
    else null
  end;
  if v_event is null then return new; end if;
  select coalesce(order_updates, true) into v_enabled
  from public.notification_preferences where user_id = new.user_id;
  if not coalesce(v_enabled, true) then return new; end if;
  v_title := case v_event
    when 'order_confirmed' then 'Order confirmed'
    when 'order_processing' then 'Order processing'
    when 'order_shipped' then 'Order shipped'
    else 'Order delivered'
  end;
  v_body := case v_event
    when 'order_confirmed' then 'Order ' || new.order_number || ' has been confirmed.'
    when 'order_processing' then 'Order ' || new.order_number || ' is being prepared.'
    when 'order_shipped' then 'Order ' || new.order_number || ' has shipped.'
    else 'Order ' || new.order_number || ' has been delivered.'
  end;
  insert into public.notifications (user_id, order_id, event_type, title, body)
  values (new.user_id, new.id, v_event, v_title, v_body);
  return new;
end;
$$;
revoke all on function public.create_customer_order_notification() from public, anon, authenticated;
drop trigger if exists orders_create_customer_notification on public.orders;
drop trigger if exists orders_create_insert_customer_notification on public.orders;
create trigger orders_create_insert_customer_notification after insert on public.orders
for each row execute function public.create_customer_order_notification();
create trigger orders_create_customer_notification after update of status on public.orders
for each row execute function public.create_customer_order_notification();

create or replace function public.create_return_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_number text;
begin
  select order_number into v_order_number from public.orders where id = new.order_id;
  insert into public.notifications (user_id, order_id, event_type, title, body)
  values (new.user_id, new.order_id, 'return_requested', 'Return request received',
    'Your return request for order ' || coalesce(v_order_number, '') || ' is awaiting review.');
  return new;
end;
$$;
revoke all on function public.create_return_notification() from public, anon, authenticated;
drop trigger if exists return_requests_create_notification on public.return_requests;
create trigger return_requests_create_notification after insert on public.return_requests
for each row execute function public.create_return_notification();
