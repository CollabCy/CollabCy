-- Attention Marketplace: hide internal identity from public/anon PostgREST reads.
-- Demo marketplace still allows anonymous listing/bidding. Payment is not implemented.
-- Does not change ranking, $2 minimum initial bid, or increment math.

-- Public read contract: no owner_id, bidder_id, email, IP, or rate-limit subject.
create or replace view public.attention_products_public
with (security_invoker = false)
as
select
  id,
  brand_name,
  name,
  slug,
  logo,
  color,
  website_url,
  description,
  category,
  tags,
  status,
  listing_starts_at,
  listing_ends_at,
  current_bid,
  click_count,
  campaign_title,
  campaign_description,
  campaign_requirements,
  campaign_budget,
  created_at
from public.attention_products
where status in ('active', 'expired');

create or replace view public.attention_bids_public
with (security_invoker = false)
as
select
  b.id,
  b.product_id,
  b.amount,
  b.created_at
from public.attention_bids b
join public.attention_products p on p.id = b.product_id
where p.status in ('active', 'expired');

create or replace view public.attention_activity_public
with (security_invoker = false)
as
select
  a.id,
  a.product_id,
  a.type,
  a.amount,
  a.rank,
  a.created_at
from public.attention_activity a
join public.attention_products p on p.id = a.product_id
where p.status in ('active', 'expired');

comment on view public.attention_products_public is
  'Anonymous/authenticated marketplace catalog. Omits owner_id and other internal identity.';
comment on view public.attention_bids_public is
  'Public bid history amounts and timestamps only. Omits bidder_id.';
comment on view public.attention_activity_public is
  'Public Live Activity. Source table has no user IDs; view still scopes to public listings.';

revoke all on public.attention_products_public from public, anon, authenticated;
revoke all on public.attention_bids_public from public, anon, authenticated;
revoke all on public.attention_activity_public from public, anon, authenticated;
grant select on public.attention_products_public to anon, authenticated;
grant select on public.attention_bids_public to anon, authenticated;
grant select on public.attention_activity_public to anon, authenticated;

-- Table-level SELECT would allow PostgREST to request owner_id / bidder_id.
-- Column grants keep realtime authorization without exposing identity columns.
revoke select, insert, update, delete, truncate on table public.attention_products from anon, authenticated, public;
revoke select, insert, update, delete, truncate on table public.attention_bids from anon, authenticated, public;
revoke select, insert, update, delete, truncate on table public.attention_activity from anon, authenticated, public;

grant select (
  id,
  brand_name,
  name,
  slug,
  logo,
  color,
  website_url,
  description,
  category,
  tags,
  status,
  listing_starts_at,
  listing_ends_at,
  current_bid,
  click_count,
  campaign_title,
  campaign_description,
  campaign_requirements,
  campaign_budget,
  created_at,
  updated_at
) on table public.attention_products to anon, authenticated;

grant select (id, product_id, amount, created_at)
  on table public.attention_bids to anon, authenticated;

grant select (id, product_id, type, amount, rank, created_at)
  on table public.attention_activity to anon, authenticated;

grant update (
  name,
  logo,
  color,
  website_url,
  description,
  category,
  tags,
  campaign_title,
  campaign_description,
  campaign_requirements,
  campaign_budget
) on table public.attention_products to authenticated;

-- Demo bids must not persist auth user IDs on a publicly readable bid table.
-- Ranking still uses locked current_bid + increment; client cannot set current_bid.
create or replace function public.place_attention_bid(p_product_id uuid, p_increment integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.attention_products;
  v_min integer;
  v_new integer;
  v_now timestamptz := now();
  v_bid_id uuid;
  v_rank integer;
  v_subject text := public.attention_request_subject();
begin
  if p_product_id is null then
    raise exception 'This listing has expired and cannot receive bids.';
  end if;
  if p_increment is null or p_increment <= 0 then
    raise exception 'Enter a valid bid amount.';
  end if;
  if p_increment > 100000 then
    raise exception 'Demo bids must be $100,000 or less.';
  end if;

  if v_subject is not null then
    perform public.attention_rate_limit('bid:' || p_product_id::text || ':' || v_subject, 1, interval '2 seconds');
    perform public.attention_rate_limit('bid-user:' || v_subject, 20, interval '1 minute');
  end if;
  perform public.attention_rate_limit('bid-product:' || p_product_id::text, 30, interval '1 minute');

  select * into v_product
  from public.attention_products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'This listing has expired and cannot receive bids.';
  end if;

  if v_product.status is distinct from 'active'
     or v_product.listing_starts_at is null
     or v_product.listing_ends_at is null
     or v_product.listing_starts_at > v_now
     or v_product.listing_ends_at <= v_now then
    raise exception 'This listing has expired and cannot receive bids.';
  end if;

  -- Absolute bid is always locked current_bid + increment. Client cannot supply current_bid.
  v_new := v_product.current_bid + p_increment;
  if v_new > 100000 then
    raise exception 'Demo bids must be $100,000 or less.';
  end if;

  v_min := public.attention_minimum_bid(p_product_id, v_now);
  if v_min is null then
    raise exception 'This listing has expired and cannot receive bids.';
  end if;
  if p_increment < v_min then
    raise exception 'Enter at least $% to improve this product’s position.', v_min;
  end if;

  insert into public.attention_bids (product_id, bidder_id, amount, created_at)
  values (p_product_id, null, v_new, v_now)
  returning id into v_bid_id;

  update public.attention_products
  set current_bid = v_new,
      updated_at = v_now
  where id = p_product_id;

  v_rank := public.attention_resulting_rank(p_product_id, v_new, v_now);

  insert into public.attention_activity (product_id, type, amount, rank, created_at)
  values (p_product_id, 'bid', v_new, v_rank, v_now);

  return jsonb_build_object(
    'product_id', p_product_id,
    'bid_id', v_bid_id,
    'amount', v_new,
    'current_bid', v_new,
    'resulting_rank', v_rank,
    'created_at', v_now
  );
end;
$$;

revoke all on function public.place_attention_bid(uuid, integer) from public;
grant execute on function public.place_attention_bid(uuid, integer) to anon, authenticated;

revoke all on function public.record_attention_visit(uuid) from public;
grant execute on function public.record_attention_visit(uuid) to anon, authenticated;

revoke all on function public.publish_attention_listing(text, text, text, text, text, text, integer, text, text, text, text, numeric) from public;
grant execute on function public.publish_attention_listing(text, text, text, text, text, text, integer, text, text, text, text, numeric) to anon, authenticated;

revoke all on table public.attention_rate_windows from public, anon, authenticated;
revoke all on function public.attention_request_subject() from public, anon, authenticated;
revoke all on function public.attention_rate_limit(text, integer, interval) from public, anon, authenticated;
