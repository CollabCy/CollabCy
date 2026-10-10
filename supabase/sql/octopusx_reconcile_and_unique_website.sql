-- OctopusX production reconciliation, then unique live-website index.
-- Run this entire file once in the Supabase SQL Editor (postgres role).
-- Do not run via anon/authenticated PostgREST. Does not charge, refund, or change Dodo IDs.
--
-- Two transactions on purpose. The previous single-transaction script hid the
-- OctopusX rows, then aborted on a GLOBAL live-website duplicate check
-- (any active/draft pair sharing a hostname, not only octopusx.ai). That
-- rollback restored the $3/$6/draft listings and dropped the new function.
-- Transaction 1 commits the OctopusX data fix even if transaction 2 cannot
-- yet create the unique index.
--
-- Third payment cks_0NpPvrD03A4XYEL4OIrQU is left pending: SQL cannot
-- authoritatively retrieve a Dodo checkout session. Verify it in Dodo before
-- expiring that row.

-- =============================================================================
-- Transaction 1: reconcile OctopusX listings/bids only
-- =============================================================================
begin;
set local lock_timeout = '8s';
set local statement_timeout = '120s';

create or replace function public.attention_website_key(p_url text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := trim(coalesce(p_url, ''));
  v_auth text;
  v_host text;
  v_port text;
begin
  if v = '' or char_length(v) > 2048 or v ~ '[[:space:]]' then
    return null;
  end if;
  if v !~* '^https?://' then
    v := 'https://' || v;
  end if;
  if v !~* '^https?://[^/?#]' then
    return null;
  end if;

  v_auth := substring(v from '^https?://([^/?#]*)');
  if v_auth is null or v_auth = '' then
    return null;
  end if;
  if position('@' in v_auth) > 0 then
    v_auth := substring(v_auth from '@([^@]*)$');
  end if;
  if v_auth is null or v_auth = '' or position('@' in v_auth) > 0 then
    return null;
  end if;

  if left(v_auth, 1) = '[' then
    return null;
  end if;

  if v_auth ~ ':' then
    if v_auth !~ '^[^[\]]+:[0-9]{1,5}$' then
      return null;
    end if;
    v_port := split_part(v_auth, ':', 2);
    if v_port::integer not between 1 and 65535 then
      return null;
    end if;
    v_host := lower(split_part(v_auth, ':', 1));
  else
    v_host := lower(v_auth);
  end if;

  v_host := rtrim(v_host, '.');
  if v_host like 'www.%' then
    v_host := substr(v_host, 5);
  end if;
  if v_host = '' or v_host in ('localhost', '127.0.0.1', '0.0.0.0') or v_host ~ '[[\]]' then
    return null;
  end if;
  if v_host !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
     and v_host !~ '^([0-9]{1,3}\.){3}[0-9]{1,3}$' then
    return null;
  end if;
  return v_host;
end;
$$;

do $$
declare
  v_canonical public.attention_products;
  v_six public.attention_products;
  v_third public.attention_products;
  v_three_pay public.attention_bid_payments;
  v_six_pay public.attention_bid_payments;
  v_third_pay public.attention_bid_payments;
  v_three_bid public.attention_bids;
  v_six_bid public.attention_bids;
  v_updated integer;
  v_nine_bids integer;
  v_nine_activity integer;
  v_canonical_bids integer;
  v_listing_activity integer;
  v_expected_key text := 'octopusx.ai';
  v_octopus_live integer;
begin
  select * into v_canonical
  from public.attention_products
  where id = 'bc1d0cae-b355-42c4-b239-b3367ceb09ac'
  for update;
  if not found then raise exception 'STOP: canonical listing missing'; end if;

  select * into v_six
  from public.attention_products
  where id = '364d6628-2904-4773-bf75-4c856b49fc11'
  for update;
  if not found then raise exception 'STOP: $6 listing missing'; end if;

  select * into v_third
  from public.attention_products
  where id = 'f387b38b-c6e2-4557-baf5-b4fb919cf774'
  for update;
  if not found then raise exception 'STOP: third listing missing'; end if;

  select * into v_three_pay
  from public.attention_bid_payments
  where id = 'ead97d2d-ea48-4d65-8bb6-b5a46abc3617'
  for update;
  select * into v_six_pay
  from public.attention_bid_payments
  where id = 'f82b060a-92f4-4948-ab2a-4a9aa0c0219e'
  for update;
  select * into v_third_pay
  from public.attention_bid_payments
  where id = 'd88981fa-e386-41e6-b1e4-41a97a8fb76d'
  for update;

  select * into v_three_bid
  from public.attention_bids
  where id = '09d001a7-dc99-46d1-ae0e-4603668bee71'
  for update;
  select * into v_six_bid
  from public.attention_bids
  where id = '9c3fba34-c7e0-48fc-8091-3e78a9d59ada'
  for update;

  if public.attention_website_key(v_canonical.website_url) is distinct from v_expected_key
     or public.attention_website_key(v_six.website_url) is distinct from v_expected_key
     or public.attention_website_key(v_third.website_url) is distinct from v_expected_key then
    raise exception 'STOP: website identity is not octopusx.ai'
      using detail = format(
        'canonical=%s six=%s third=%s',
        public.attention_website_key(v_canonical.website_url),
        public.attention_website_key(v_six.website_url),
        public.attention_website_key(v_third.website_url)
      );
  end if;

  if v_canonical.slug is distinct from 'octopusx'
     or v_canonical.status is distinct from 'active'
     or v_canonical.current_bid not in (3, 9) then
    raise exception 'STOP: canonical listing unexpected'
      using detail = format('slug=%s status=%s current_bid=%s', v_canonical.slug, v_canonical.status, v_canonical.current_bid);
  end if;
  if v_six.slug is distinct from 'octopusx-364d6628'
     or v_six.current_bid is distinct from 6
     or v_six.status not in ('active', 'hidden') then
    raise exception 'STOP: $6 listing unexpected'
      using detail = format('slug=%s status=%s current_bid=%s', v_six.slug, v_six.status, v_six.current_bid);
  end if;
  if v_third.slug not like 'octopusx-f387b38b%'
     or v_third.status not in ('draft', 'hidden') then
    raise exception 'STOP: third listing unexpected'
      using detail = format('slug=%s status=%s current_bid=%s', v_third.slug, v_third.status, v_third.current_bid);
  end if;

  if v_three_pay.id is null
     or v_three_pay.product_id is distinct from 'bc1d0cae-b355-42c4-b239-b3367ceb09ac'
     or v_three_pay.status is distinct from 'applied'
     or coalesce(v_three_pay.kind, 'bid') is distinct from 'listing'
     or v_three_pay.increment is distinct from 3
     or v_three_pay.amount_cents is distinct from 300
     or v_three_pay.dodo_payment_id is distinct from 'pay_0NpPv0hEmViVlmah8ZZFB'
     or v_three_pay.applied_bid_id is distinct from '09d001a7-dc99-46d1-ae0e-4603668bee71' then
    raise exception 'STOP: $3 payment not in expected applied state';
  end if;

  if v_six_pay.id is null
     or v_six_pay.product_id is distinct from '364d6628-2904-4773-bf75-4c856b49fc11'
     or v_six_pay.status is distinct from 'applied'
     or coalesce(v_six_pay.kind, 'bid') is distinct from 'listing'
     or v_six_pay.increment is distinct from 6
     or v_six_pay.amount_cents is distinct from 600
     or v_six_pay.dodo_payment_id is distinct from 'pay_0NpPxF3NRm5j1MjV1Ubez'
     or v_six_pay.applied_bid_id is distinct from '9c3fba34-c7e0-48fc-8091-3e78a9d59ada' then
    raise exception 'STOP: $6 payment not in expected applied state';
  end if;

  if v_third_pay.id is null
     or v_third_pay.product_id is distinct from 'f387b38b-c6e2-4557-baf5-b4fb919cf774'
     or coalesce(v_third_pay.kind, 'bid') is distinct from 'listing'
     or v_third_pay.dodo_session_id is distinct from 'cks_0NpPvrD03A4XYEL4OIrQU' then
    raise exception 'STOP: third payment row identity unexpected';
  end if;
  if v_third_pay.status = 'applied' or v_third_pay.dodo_payment_id is not null or v_third_pay.applied_bid_id is not null then
    raise exception 'STOP: third checkout appears to have a successful payment; do not hide blindly'
      using detail = format(
        'status=%s dodo_payment_id=%s applied_bid_id=%s',
        v_third_pay.status, v_third_pay.dodo_payment_id, v_third_pay.applied_bid_id
      );
  end if;

  if v_three_bid.id is null
     or v_three_bid.product_id is distinct from 'bc1d0cae-b355-42c4-b239-b3367ceb09ac'
     or v_three_bid.amount is distinct from 3 then
    raise exception 'STOP: canonical $3 bid missing or mutated';
  end if;
  if v_six_bid.id is null
     or v_six_bid.product_id is distinct from '364d6628-2904-4773-bf75-4c856b49fc11'
     or v_six_bid.amount is distinct from 6 then
    raise exception 'STOP: $6 bid missing or mutated';
  end if;

  select count(*) into v_listing_activity
  from public.attention_activity
  where product_id = 'bc1d0cae-b355-42c4-b239-b3367ceb09ac' and type = 'listing' and amount = 3;
  if v_listing_activity < 1 then
    raise exception 'STOP: canonical listing activity missing';
  end if;

  select count(*) into v_canonical_bids
  from public.attention_bids
  where product_id = 'bc1d0cae-b355-42c4-b239-b3367ceb09ac';
  select count(*) into v_nine_bids
  from public.attention_bids
  where product_id = 'bc1d0cae-b355-42c4-b239-b3367ceb09ac' and amount = 9;
  select count(*) into v_nine_activity
  from public.attention_activity
  where product_id = 'bc1d0cae-b355-42c4-b239-b3367ceb09ac' and type = 'bid' and amount = 9;

  if v_canonical.current_bid = 3 then
    if v_canonical_bids <> 1 or v_nine_bids <> 0 or v_nine_activity <> 0 then
      raise exception 'STOP: canonical bid/activity history is not the original $3 listing'
        using detail = format('bid_count=%s nine_bids=%s nine_activity=%s', v_canonical_bids, v_nine_bids, v_nine_activity);
    end if;
    update public.attention_products
    set current_bid = 9, updated_at = now()
    where id = 'bc1d0cae-b355-42c4-b239-b3367ceb09ac' and status = 'active' and current_bid = 3;
    get diagnostics v_updated = row_count;
    if v_updated <> 1 then raise exception 'STOP: canonical bid update matched % rows', v_updated; end if;

    insert into public.attention_bids (product_id, bidder_id, amount, created_at)
    values ('bc1d0cae-b355-42c4-b239-b3367ceb09ac', null, 9, now());

    insert into public.attention_activity (product_id, type, amount, rank, created_at)
    values (
      'bc1d0cae-b355-42c4-b239-b3367ceb09ac',
      'bid',
      9,
      public.attention_resulting_rank('bc1d0cae-b355-42c4-b239-b3367ceb09ac', 9, now()),
      now()
    );
  elsif v_canonical_bids <> 2 or v_nine_bids <> 1 or v_nine_activity <> 1 then
    raise exception 'STOP: current_bid is 9 but $9 bid/activity is not exactly once'
      using detail = format('bid_count=%s nine_bids=%s nine_activity=%s', v_canonical_bids, v_nine_bids, v_nine_activity);
  end if;

  select count(*) into v_nine_bids
  from public.attention_bids
  where product_id = 'bc1d0cae-b355-42c4-b239-b3367ceb09ac' and amount = 9;
  select count(*) into v_nine_activity
  from public.attention_activity
  where product_id = 'bc1d0cae-b355-42c4-b239-b3367ceb09ac' and type = 'bid' and amount = 9;
  if v_nine_bids <> 1 or v_nine_activity <> 1 then
    raise exception 'STOP: $9 bid/activity must exist exactly once';
  end if;
  if (
    select current_bid from public.attention_products
    where id = 'bc1d0cae-b355-42c4-b239-b3367ceb09ac'
  ) is distinct from 9 then
    raise exception 'STOP: canonical current_bid is not 9 after credit';
  end if;

  update public.attention_products
  set status = 'hidden', updated_at = now()
  where id = '364d6628-2904-4773-bf75-4c856b49fc11'
    and status in ('active', 'hidden')
    and current_bid = 6;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then raise exception 'STOP: $6 listing hide matched % rows', v_updated; end if;

  update public.attention_products
  set status = 'hidden', updated_at = now()
  where id = 'f387b38b-c6e2-4557-baf5-b4fb919cf774'
    and status in ('draft', 'hidden');
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then raise exception 'STOP: third listing hide matched % rows', v_updated; end if;

  -- Do not UPDATE the third payment row. Local pending/NULL is not a Dodo proof of unpaid.

  if (
    select count(*) from public.attention_bid_payments
    where id = 'ead97d2d-ea48-4d65-8bb6-b5a46abc3617'
      and status = 'applied'
      and dodo_payment_id = 'pay_0NpPv0hEmViVlmah8ZZFB'
      and applied_bid_id = '09d001a7-dc99-46d1-ae0e-4603668bee71'
  ) <> 1 then
    raise exception 'STOP: $3 payment identity changed';
  end if;
  if (
    select count(*) from public.attention_bid_payments
    where id = 'f82b060a-92f4-4948-ab2a-4a9aa0c0219e'
      and status = 'applied'
      and dodo_payment_id = 'pay_0NpPxF3NRm5j1MjV1Ubez'
      and applied_bid_id = '9c3fba34-c7e0-48fc-8091-3e78a9d59ada'
  ) <> 1 then
    raise exception 'STOP: $6 payment identity changed';
  end if;
  if (
    select count(*) from public.attention_bid_payments
    where id = 'd88981fa-e386-41e6-b1e4-41a97a8fb76d'
      and dodo_session_id = 'cks_0NpPvrD03A4XYEL4OIrQU'
      and dodo_payment_id is not distinct from v_third_pay.dodo_payment_id
      and status is not distinct from v_third_pay.status
  ) <> 1 then
    raise exception 'STOP: third payment row was mutated';
  end if;

  select count(*) into v_octopus_live
  from public.attention_products
  where status in ('active', 'draft')
    and public.attention_website_key(website_url) = v_expected_key
    and id not in ('bc1d0cae-b355-42c4-b239-b3367ceb09ac');
  if v_octopus_live <> 0 then
    raise exception 'STOP: other live octopusx.ai listings remain after hide'
      using detail = (
        select string_agg(format('%s:%s:%s', id, slug, status), ', ')
        from public.attention_products
        where status in ('active', 'draft')
          and public.attention_website_key(website_url) = v_expected_key
          and id <> 'bc1d0cae-b355-42c4-b239-b3367ceb09ac'
      );
  end if;

  raise notice 'OctopusX recon ready to commit: canonical $9 active; $6 and draft hidden; third payment unchanged pending Dodo session cks_0NpPvrD03A4XYEL4OIrQU';
end
$$;

commit;

-- =============================================================================
-- Transaction 2: rebuild unique live-website index from the current function.
-- Drops only attention_products_website_key_live_uidx, in the same transaction
-- as recreate, so a failure restores the previous index.
-- =============================================================================
begin;
set local lock_timeout = '8s';
set local statement_timeout = '120s';

create or replace function public.attention_website_key(p_url text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text := trim(coalesce(p_url, ''));
  v_auth text;
  v_host text;
  v_port text;
begin
  if v = '' or char_length(v) > 2048 or v ~ '[[:space:]]' then
    return null;
  end if;
  if v !~* '^https?://' then
    v := 'https://' || v;
  end if;
  if v !~* '^https?://[^/?#]' then
    return null;
  end if;

  v_auth := substring(v from '^https?://([^/?#]*)');
  if v_auth is null or v_auth = '' then
    return null;
  end if;
  if position('@' in v_auth) > 0 then
    v_auth := substring(v_auth from '@([^@]*)$');
  end if;
  if v_auth is null or v_auth = '' or position('@' in v_auth) > 0 then
    return null;
  end if;

  if left(v_auth, 1) = '[' then
    return null;
  end if;

  if v_auth ~ ':' then
    if v_auth !~ '^[^[\]]+:[0-9]{1,5}$' then
      return null;
    end if;
    v_port := split_part(v_auth, ':', 2);
    if v_port::integer not between 1 and 65535 then
      return null;
    end if;
    v_host := lower(split_part(v_auth, ':', 1));
  else
    v_host := lower(v_auth);
  end if;

  v_host := rtrim(v_host, '.');
  if v_host like 'www.%' then
    v_host := substr(v_host, 5);
  end if;
  if v_host = '' or v_host in ('localhost', '127.0.0.1', '0.0.0.0') or v_host ~ '[[\]]' then
    return null;
  end if;
  if v_host !~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
     and v_host !~ '^([0-9]{1,3}\.){3}[0-9]{1,3}$' then
    return null;
  end if;
  return v_host;
end;
$$;

create or replace function public.create_pending_attention_listing(
  p_name text,
  p_website_url text,
  p_description text,
  p_category text,
  p_logo text,
  p_color text,
  p_initial_bid integer,
  p_brand_name text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_id uuid := gen_random_uuid();
  v_base text;
  v_slug text;
  v_logo text;
  v_color text;
  v_brand text;
  v_website text;
  v_website_key text;
  v_constraint text;
  v_existing public.attention_products;
  v_name text := trim(coalesce(p_name, ''));
  v_description text := trim(coalesce(p_description, ''));
  v_subject text := public.attention_request_subject();
  v_categories text[] := array[
    'AI Tools','SaaS','Developer Tools','Marketing','Productivity','Apps','Finance','Design','Education','Gaming','Other'
  ];
begin
  if v_subject is not null then
    perform public.attention_rate_limit('list-user:' || v_subject, 3, interval '10 minutes');
  end if;
  perform public.attention_rate_limit('list-global', 20, interval '5 minutes');

  if v_name = '' or char_length(v_name) > 80 or char_length(v_description) > 500 then
    raise exception 'Add a product name, description, category, and valid website.';
  end if;
  v_website := public.attention_clean_website(p_website_url);
  if v_website is null then
    raise exception 'Add a product name, description, category, and valid website.';
  end if;
  v_website_key := public.attention_website_key(v_website);
  if v_website_key is null then
    raise exception 'Add a product name, description, category, and valid website.';
  end if;
  if p_category is null or not (p_category = any (v_categories)) then
    raise exception 'Add a product name, description, category, and valid website.';
  end if;
  if p_initial_bid is null or p_initial_bid < 2 or p_initial_bid > 100000 then
    raise exception 'Initial bid must be a whole dollar between $2 and $100,000.';
  end if;

  perform pg_advisory_xact_lock(hashtext('attention-website:' || v_website_key));

  select *
    into v_existing
  from public.attention_products
  where public.attention_website_key(website_url) = v_website_key
    and status in ('active', 'draft')
  order by case when status = 'active' then 0 else 1 end, created_at asc
  limit 1
  for update;

  if found then
    return jsonb_build_object(
      'ok', false,
      'reason', 'already_listed',
      'id', v_existing.id,
      'slug', v_existing.slug,
      'status', v_existing.status
    );
  end if;

  if exists (
    select 1
    from public.attention_products
    where lower(name) = lower(v_name)
      and website_url = v_website
      and created_at > v_now - interval '45 seconds'
  ) then
    raise exception 'This product was just listed. Please wait before listing it again.';
  end if;

  v_brand := coalesce(nullif(trim(coalesce(p_brand_name, '')), ''), v_name, 'Brand');
  if char_length(v_brand) > 80 then
    v_brand := left(v_brand, 80);
  end if;
  v_logo := nullif(trim(coalesce(p_logo, '')), '');
  if v_logo is null then
    v_logo := left(v_name, 1);
  elsif char_length(v_logo) > 700000 then
    raise exception 'Add a product name, description, category, and valid website.';
  elsif v_logo like 'data:image/%' then
    if v_logo !~* '^data:image/(png|jpeg|jpg|webp);base64,' then
      raise exception 'Add a product name, description, category, and valid website.';
    end if;
  elsif v_logo like 'http%' then
    if public.attention_clean_website(v_logo) is null then
      raise exception 'Add a product name, description, category, and valid website.';
    end if;
  elsif char_length(v_logo) > 8 then
    raise exception 'Add a product name, description, category, and valid website.';
  end if;
  v_color := coalesce(nullif(trim(coalesce(p_color, '')), ''), '#3267e8');
  if v_color !~ '^#[0-9A-Fa-f]{6}$' then
    v_color := '#3267e8';
  end if;

  v_base := trim(both '-' from regexp_replace(lower(v_name), '[^a-z0-9]+', '-', 'g'));
  if v_base is null or v_base = '' then
    v_base := 'product';
  end if;
  v_slug := v_base;
  if exists (select 1 from public.attention_products where slug = v_slug) then
    v_slug := v_base || '-' || substr(replace(v_id::text, '-', ''), 1, 8);
  end if;

  begin
    insert into public.attention_products (
      id, owner_id, brand_name, name, slug, logo, color, website_url, description, category, tags,
      status, listing_starts_at, listing_ends_at, current_bid, click_count,
      created_at, updated_at
    ) values (
      v_id, null, v_brand, v_name, v_slug, v_logo, v_color, v_website, v_description, p_category, '{}',
      'draft', null, null, 0, 0,
      v_now, v_now
    );
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      select *
        into v_existing
      from public.attention_products
      where public.attention_website_key(website_url) = v_website_key
        and status in ('active', 'draft')
      order by case when status = 'active' then 0 else 1 end, created_at asc
      limit 1;
      if found and v_constraint = 'attention_products_website_key_live_uidx' then
        return jsonb_build_object(
          'ok', false,
          'reason', 'already_listed',
          'id', v_existing.id,
          'slug', v_existing.slug,
          'status', v_existing.status
        );
      end if;
      raise;
  end;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'slug', v_slug,
    'status', 'draft',
    'current_bid', 0,
    'listing_starts_at', null
  );
end;
$$;

revoke all on function public.attention_website_key(text) from public, anon, authenticated;
grant execute on function public.attention_website_key(text) to service_role;
revoke all on function public.create_pending_attention_listing(text, text, text, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.create_pending_attention_listing(text, text, text, text, text, text, integer, text) to service_role;

do $$
declare
  v_unique boolean;
  v_valid boolean;
  v_def text;
  v_detail text;
begin
  select string_agg(format('key=%s [%s]', website_key, id_list), ' | ' order by website_key)
    into v_detail
  from (
    select
      public.attention_website_key(website_url) as website_key,
      string_agg(format('%s:%s:%s', id, slug, status), ', ' order by created_at, id) as id_list
    from public.attention_products
    where status in ('active', 'draft')
      and public.attention_website_key(website_url) is not null
    group by 1
    having count(*) > 1
  ) duplicates;

  if v_detail is not null then
    raise exception 'Cannot create attention_products_website_key_live_uidx: live website duplicates exist.'
      using detail = v_detail;
  end if;

  drop index if exists public.attention_products_website_key_live_uidx;

  execute $index$
    create unique index attention_products_website_key_live_uidx
      on public.attention_products (public.attention_website_key(website_url))
      where status in ('active', 'draft')
  $index$;

  select i.indisunique, i.indisvalid, pg_get_indexdef(i.indexrelid)
    into v_unique, v_valid, v_def
  from pg_index i
  join pg_class c on c.oid = i.indexrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'attention_products_website_key_live_uidx';
  if v_unique is not true or v_valid is not true
     or v_def is null
     or v_def !~* 'unique'
     or v_def !~* 'attention_website_key'
     or v_def !~* 'active'
     or v_def !~* 'draft' then
    raise exception 'attention_products_website_key_live_uidx was not created as a valid unique index.'
      using detail = coalesce(v_def, 'missing');
  end if;
end
$$;

commit;

-- Read-only verification (run after both transactions succeed):
-- select id, slug, status, current_bid from public.attention_products
--   where id in (
--     'bc1d0cae-b355-42c4-b239-b3367ceb09ac',
--     '364d6628-2904-4773-bf75-4c856b49fc11',
--     'f387b38b-c6e2-4557-baf5-b4fb919cf774'
--   );
-- select id, status, increment, amount_cents, dodo_payment_id, applied_bid_id, dodo_session_id
--   from public.attention_bid_payments
--   where id in (
--     'ead97d2d-ea48-4d65-8bb6-b5a46abc3617',
--     'f82b060a-92f4-4948-ab2a-4a9aa0c0219e',
--     'd88981fa-e386-41e6-b1e4-41a97a8fb76d'
--   );
-- select indexdef from pg_indexes
--   where schemaname = 'public' and indexname = 'attention_products_website_key_live_uidx';
