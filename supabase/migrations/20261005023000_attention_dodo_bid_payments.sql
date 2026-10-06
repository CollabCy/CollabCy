-- Attention Marketplace Dodo bid payments.
-- Local / Test Mode only. Do not apply this migration to production unless explicitly requested.

create table if not exists public.attention_bid_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id),
  product_id uuid not null references public.attention_products (id),
  increment integer not null,
  amount_cents integer not null,
  currency text not null default 'USD',
  dodo_session_id text unique,
  dodo_payment_id text unique,
  webhook_id text unique,
  status text not null,
  applied_bid_id uuid null references public.attention_bids (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint attention_bid_payments_increment_check check (increment > 0),
  constraint attention_bid_payments_amount_check check (amount_cents > 0),
  constraint attention_bid_payments_amount_matches_increment check (amount_cents = increment * 100),
  constraint attention_bid_payments_currency_check check (currency = 'USD'),
  constraint attention_bid_payments_status_check check (status in ('pending', 'paid', 'applied', 'failed', 'expired'))
);

create index if not exists attention_bid_payments_user_id_idx
  on public.attention_bid_payments (user_id);
create index if not exists attention_bid_payments_product_id_idx
  on public.attention_bid_payments (product_id);
create index if not exists attention_bid_payments_status_idx
  on public.attention_bid_payments (status);

create or replace function public.set_attention_bid_payments_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists attention_bid_payments_set_updated_at on public.attention_bid_payments;
create trigger attention_bid_payments_set_updated_at
before update on public.attention_bid_payments
for each row
execute procedure public.set_attention_bid_payments_updated_at();

alter table public.attention_bid_payments enable row level security;
alter table public.attention_bid_payments force row level security;

revoke all on table public.attention_bid_payments from public, anon, authenticated;
grant select, insert, update on table public.attention_bid_payments to service_role;

create or replace function public.claim_paid_attention_bid_payment(
  p_payment_id uuid,
  p_dodo_payment_id text,
  p_dodo_session_id text,
  p_webhook_id text,
  p_amount_cents integer,
  p_currency text,
  p_user_id uuid,
  p_product_id uuid,
  p_increment integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.attention_bid_payments;
  v_by_webhook public.attention_bid_payments;
  v_by_dodo public.attention_bid_payments;
begin
  if p_payment_id is null or p_dodo_payment_id is null or p_webhook_id is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_event');
  end if;
  if p_currency is null or upper(p_currency) is distinct from 'USD' then
    return jsonb_build_object('ok', false, 'reason', 'currency_mismatch');
  end if;

  select * into v_by_webhook
  from public.attention_bid_payments
  where webhook_id = p_webhook_id
  for update;

  if found then
    if v_by_webhook.id is distinct from p_payment_id then
      return jsonb_build_object('ok', false, 'reason', 'webhook_conflict');
    end if;
    if v_by_webhook.status = 'applied' then
      return jsonb_build_object('ok', true, 'reason', 'already_applied', 'payment_id', v_by_webhook.id, 'bid_id', v_by_webhook.applied_bid_id);
    end if;
    if v_by_webhook.status = 'paid' then
      return jsonb_build_object('ok', true, 'reason', 'already_paid', 'payment_id', v_by_webhook.id);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  select * into v_by_dodo
  from public.attention_bid_payments
  where dodo_payment_id = p_dodo_payment_id
  for update;

  if found then
    if v_by_dodo.id is distinct from p_payment_id then
      return jsonb_build_object('ok', false, 'reason', 'payment_conflict');
    end if;
    if v_by_dodo.status = 'applied' then
      return jsonb_build_object('ok', true, 'reason', 'already_applied', 'payment_id', v_by_dodo.id, 'bid_id', v_by_dodo.applied_bid_id);
    end if;
    if v_by_dodo.status = 'paid' then
      if v_by_dodo.webhook_id is null then
        update public.attention_bid_payments
        set webhook_id = p_webhook_id
        where id = v_by_dodo.id;
      end if;
      return jsonb_build_object('ok', true, 'reason', 'already_paid', 'payment_id', v_by_dodo.id);
    end if;
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  select * into v_payment
  from public.attention_bid_payments
  where id = p_payment_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_payment.status = 'applied' then
    return jsonb_build_object('ok', true, 'reason', 'already_applied', 'payment_id', v_payment.id, 'bid_id', v_payment.applied_bid_id);
  end if;

  if v_payment.status = 'paid' then
    if v_payment.dodo_payment_id is distinct from p_dodo_payment_id
       and v_payment.dodo_payment_id is not null then
      return jsonb_build_object('ok', false, 'reason', 'payment_conflict');
    end if;
    update public.attention_bid_payments
    set dodo_payment_id = coalesce(dodo_payment_id, p_dodo_payment_id),
        dodo_session_id = coalesce(dodo_session_id, nullif(p_dodo_session_id, '')),
        webhook_id = coalesce(webhook_id, p_webhook_id)
    where id = v_payment.id;
    return jsonb_build_object('ok', true, 'reason', 'already_paid', 'payment_id', v_payment.id);
  end if;

  if v_payment.status is distinct from 'pending' then
    return jsonb_build_object('ok', false, 'reason', 'invalid_status');
  end if;

  if v_payment.dodo_session_id is not null
     and p_dodo_session_id is not null
     and v_payment.dodo_session_id is distinct from p_dodo_session_id then
    return jsonb_build_object('ok', false, 'reason', 'session_conflict');
  end if;

  if v_payment.user_id is distinct from p_user_id
     or v_payment.product_id is distinct from p_product_id
     or v_payment.increment is distinct from p_increment then
    return jsonb_build_object('ok', false, 'reason', 'metadata_mismatch');
  end if;

  if v_payment.amount_cents is distinct from p_amount_cents
     or v_payment.currency is distinct from 'USD' then
    return jsonb_build_object('ok', false, 'reason', 'amount_mismatch');
  end if;

  update public.attention_bid_payments
  set status = 'paid',
      dodo_payment_id = p_dodo_payment_id,
      dodo_session_id = coalesce(nullif(p_dodo_session_id, ''), dodo_session_id),
      webhook_id = p_webhook_id
  where id = v_payment.id;

  return jsonb_build_object('ok', true, 'reason', 'marked_paid', 'payment_id', v_payment.id);
end;
$$;

create or replace function public.apply_paid_attention_bid(p_payment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.attention_bid_payments;
  v_product public.attention_products;
  v_new integer;
  v_now timestamptz := now();
  v_bid_id uuid;
  v_rank integer;
begin
  if p_payment_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  select * into v_payment
  from public.attention_bid_payments
  where id = p_payment_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if v_payment.status = 'applied' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'reason', 'already_applied',
      'payment_id', v_payment.id,
      'bid_id', v_payment.applied_bid_id
    );
  end if;

  if v_payment.status is distinct from 'paid' then
    return jsonb_build_object('ok', false, 'reason', 'not_paid', 'payment_id', v_payment.id);
  end if;

  select * into v_product
  from public.attention_products
  where id = v_payment.product_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'product_inactive', 'payment_id', v_payment.id);
  end if;

  if v_product.status is distinct from 'active'
     or v_product.listing_starts_at is null
     or v_product.listing_ends_at is null
     or v_product.listing_starts_at > v_now
     or v_product.listing_ends_at <= v_now then
    return jsonb_build_object('ok', false, 'reason', 'product_inactive', 'payment_id', v_payment.id);
  end if;

  -- Apply the increment the user already paid for, even if the minimum has risen.
  v_new := v_product.current_bid + v_payment.increment;
  if v_new > 100000 then
    return jsonb_build_object('ok', false, 'reason', 'bid_cap', 'payment_id', v_payment.id);
  end if;

  insert into public.attention_bids (product_id, bidder_id, amount, created_at)
  values (v_payment.product_id, v_payment.user_id, v_new, v_now)
  returning id into v_bid_id;

  update public.attention_products
  set current_bid = v_new,
      updated_at = v_now
  where id = v_payment.product_id;

  v_rank := public.attention_resulting_rank(v_payment.product_id, v_new, v_now);

  insert into public.attention_activity (product_id, type, amount, rank, created_at)
  values (v_payment.product_id, 'bid', v_new, v_rank, v_now);

  update public.attention_bid_payments
  set status = 'applied',
      applied_bid_id = v_bid_id
  where id = v_payment.id;

  return jsonb_build_object(
    'ok', true,
    'reason', 'applied',
    'payment_id', v_payment.id,
    'bid_id', v_bid_id,
    'amount', v_new,
    'current_bid', v_new,
    'resulting_rank', v_rank
  );
end;
$$;

revoke all on function public.claim_paid_attention_bid_payment(uuid, text, text, text, integer, text, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.claim_paid_attention_bid_payment(uuid, text, text, text, integer, text, uuid, uuid, integer) to service_role;

revoke all on function public.apply_paid_attention_bid(uuid) from public, anon, authenticated;
grant execute on function public.apply_paid_attention_bid(uuid) to service_role;

revoke all on function public.place_attention_bid(uuid, integer) from public, anon, authenticated;
