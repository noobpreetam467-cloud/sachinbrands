create or replace function public.confirm_razorpay_payment(p_order_id uuid, p_provider_payment_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payments set status = 'paid', provider_payment_id = p_provider_payment_id
  where order_id = p_order_id and method = 'razorpay' and status = 'pending';
  if not found then
    if exists (
      select 1 from public.payments where order_id = p_order_id
        and method = 'razorpay' and status = 'paid' and provider_payment_id = p_provider_payment_id
    ) then return; end if;
    raise exception 'Pending payment not found';
  end if;
  update public.orders set status = 'confirmed', payment_status = 'paid'
    where id = p_order_id and status = 'pending_payment';
  if not found then raise exception 'Order is no longer awaiting payment'; end if;
  update public.coupon_redemptions set status = 'redeemed' where order_id = p_order_id;
end;
$$;
revoke all on function public.confirm_razorpay_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_razorpay_payment(uuid, text) to service_role;
