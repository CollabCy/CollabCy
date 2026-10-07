-- Attention Marketplace: lifetime listings and anonymous paid bids.
-- Local implementation file. Do not apply to production unless explicitly requested.
-- Does not edit or revert 20261005023000_attention_dodo_bid_payments.sql.

-- Live listings stay active until status is changed. NULL listing_ends_at means no expiry.
create or replace function public.attention_product_is_live(p public.attention_products, p_now timestamptz default now())
returns boolean
language sql
stable
set search_path = public
as $$
  select p.status = 'active'
     and p.listing_starts_at is not null
     and p.listing_starts_at <= p_now
     and (p.listing_ends_at is null or p.listing_ends_at > p_now);
$$;

create or replace function public.attention_resulting_rank(p_product_id uuid, p_amount integer, p_now timestamptz default now())
returns integer
language sql
stable
set search_path = public
as $$
  select count(*)::integer + 1
  from public.attention_products p
  where p.id is distinct from p_product_id
    and p.status = 'active'
    and p.listing_starts_at is not null
    and p.listing_starts_at <= p_now
    and (p.listing_ends_at is null or p.listing_ends_at > p_now)
    and p.current_bid >= p_amount;
$$;

create or replace function public.attention_minimum_bid(p_product_id uuid, p_now timestamptz default now())
returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  v_own integer;
  v_prev integer;
  v_rn integer;
begin
  with live as (
    select
      p.id,
      p.current_bid,
      coalesce(
        (select max(b.created_at) from public.attention_bids b where b.product_id = p.id),
        p.listing_starts_at
      ) as tie_ts
    from public.attention_products p
    where p.status = 'active'
      and p.listing_starts_at is not null
      and p.listing_starts_at <= p_now
      and (p.listing_ends_at is null or p.listing_ends_at > p_now)
  ),
  ranked as (
    select
      id,
      current_bid,
      row_number() over (order by current_bid desc, tie_ts asc, id::text asc) as rn
    from live
  )
  select r.current_bid, r.rn, prev.current_bid
    into v_own, v_rn, v_prev
  from ranked r
  left join ranked prev on prev.rn = r.rn - 1
  where r.id = p_product_id;

  if v_rn is null then
    return null;
  end if;

  return coalesce(v_prev, v_own) - v_own + 1;
end;
$$;

create or replace function public.publish_attention_listing(
  p_name text,
  p_website_url text,
  p_description text,
  p_category text,
  p_logo text,
  p_color text,
  p_initial_bid integer,
  p_brand_name text,
  p_campaign_title text default null,
  p_campaign_description text default null,
  p_campaign_requirements text default null,
  p_campaign_budget numeric default null
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
  v_rank integer;
  v_has_campaign boolean;
  v_website text;
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

  if v_name = '' or char_length(v_name) > 80 or v_description = '' or char_length(v_description) > 500 then
    raise exception 'Add a product name, description, category, and valid website.';
  end if;
  v_website := public.attention_clean_website(p_website_url);
  if v_website is null then
    raise exception 'Add a product name, description, category, and valid website.';
  end if;
  if p_category is null or not (p_category = any (v_categories)) then
    raise exception 'Add a product name, description, category, and valid website.';
  end if;
  if p_initial_bid is null or p_initial_bid < 2 or p_initial_bid > 100000 then
    raise exception 'Initial bid must be a whole dollar between $2 and $100,000.';
  end if;

  v_has_campaign := coalesce(length(trim(p_campaign_title)), 0) > 0
                 or coalesce(length(trim(p_campaign_description)), 0) > 0
                 or coalesce(length(trim(p_campaign_requirements)), 0) > 0
                 or p_campaign_budget is not null;
  if v_has_campaign then
    if p_campaign_title is null or length(trim(p_campaign_title)) = 0 or char_length(trim(p_campaign_title)) > 100
       or p_campaign_description is null or length(trim(p_campaign_description)) = 0 or char_length(trim(p_campaign_description)) > 2000
       or p_campaign_requirements is null or length(trim(p_campaign_requirements)) = 0 or char_length(trim(p_campaign_requirements)) > 2000
       or p_campaign_budget is null or p_campaign_budget < 1 or p_campaign_budget > 100000 then
      raise exception 'Complete the optional creator opportunity, including its budget.';
    end if;
  end if;

  if exists (
    select 1
    from public.attention_products
    where lower(name) = lower(v_name)
      and website_url = v_website
      and status = 'active'
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
      campaign_title, campaign_description, campaign_requirements, campaign_budget,
      created_at, updated_at
    ) values (
      v_id, null, v_brand, v_name, v_slug, v_logo, v_color, v_website, v_description, p_category, '{}',
      'active', v_now, null, p_initial_bid, 0,
      case when v_has_campaign then trim(p_campaign_title) else null end,
      case when v_has_campaign then trim(p_campaign_description) else null end,
      case when v_has_campaign then trim(p_campaign_requirements) else null end,
      case when v_has_campaign then p_campaign_budget else null end,
      v_now, v_now
    );
  exception
    when unique_violation then
      v_slug := v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      insert into public.attention_products (
        id, owner_id, brand_name, name, slug, logo, color, website_url, description, category, tags,
        status, listing_starts_at, listing_ends_at, current_bid, click_count,
        campaign_title, campaign_description, campaign_requirements, campaign_budget,
        created_at, updated_at
      ) values (
        v_id, null, v_brand, v_name, v_slug, v_logo, v_color, v_website, v_description, p_category, '{}',
        'active', v_now, null, p_initial_bid, 0,
        case when v_has_campaign then trim(p_campaign_title) else null end,
        case when v_has_campaign then trim(p_campaign_description) else null end,
        case when v_has_campaign then trim(p_campaign_requirements) else null end,
        case when v_has_campaign then p_campaign_budget else null end,
        v_now, v_now
      );
  end;

  insert into public.attention_bids (product_id, bidder_id, amount, created_at)
  values (v_id, null, p_initial_bid, v_now);

  v_rank := public.attention_resulting_rank(v_id, p_initial_bid, v_now);

  insert into public.attention_activity (product_id, type, amount, rank, created_at)
  values (v_id, 'listing', p_initial_bid, v_rank, v_now);

  return jsonb_build_object(
    'id', v_id,
    'owner_id', null,
    'brand_name', v_brand,
    'name', v_name,
    'slug', v_slug,
    'logo', v_logo,
    'color', v_color,
    'website_url', v_website,
    'description', v_description,
    'category', p_category,
    'tags', '[]'::jsonb,
    'status', 'active',
    'listing_starts_at', v_now,
    'listing_ends_at', null,
    'current_bid', p_initial_bid,
    'click_count', 0,
    'campaign_title', case when v_has_campaign then trim(p_campaign_title) else null end,
    'campaign_description', case when v_has_campaign then trim(p_campaign_description) else null end,
    'campaign_requirements', case when v_has_campaign then trim(p_campaign_requirements) else null end,
    'campaign_budget', case when v_has_campaign then p_campaign_budget else null end,
    'created_at', v_now,
    'resulting_rank', v_rank
  );
end;
$$;

revoke all on function public.publish_attention_listing(text, text, text, text, text, text, integer, text, text, text, text, numeric) from public;
grant execute on function public.publish_attention_listing(text, text, text, text, text, text, integer, text, text, text, text, numeric) to anon, authenticated;

update public.attention_products
set listing_ends_at = null
where status = 'active';

alter table public.attention_bid_payments
  alter column user_id drop not null;

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
     or v_product.listing_starts_at > v_now
     or (v_product.listing_ends_at is not null and v_product.listing_ends_at <= v_now) then
    return jsonb_build_object('ok', false, 'reason', 'product_inactive', 'payment_id', v_payment.id);
  end if;

  -- Apply the increment already paid for, even if the minimum has risen.
  v_new := v_product.current_bid + v_payment.increment;
  if v_new > 100000 then
    return jsonb_build_object('ok', false, 'reason', 'bid_cap', 'payment_id', v_payment.id);
  end if;

  insert into public.attention_bids (product_id, bidder_id, amount, created_at)
  values (v_payment.product_id, null, v_new, v_now)
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
