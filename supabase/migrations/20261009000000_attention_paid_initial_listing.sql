-- Attention Marketplace: paid initial spotlight bids.
-- Local implementation file. Do not apply to production unless explicitly requested.
-- Preserves subsequent Dodo bid claim/apply, anonymous bidders, and lifetime listings.

alter table public.attention_bid_payments
  add column if not exists kind text not null default 'bid';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'attention_bid_payments_kind_check'
      and conrelid = 'public.attention_bid_payments'::regclass
  ) then
    alter table public.attention_bid_payments
      add constraint attention_bid_payments_kind_check
      check (kind in ('bid', 'listing'));
  end if;
end
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
      v_slug := v_base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      insert into public.attention_products (
        id, owner_id, brand_name, name, slug, logo, color, website_url, description, category, tags,
        status, listing_starts_at, listing_ends_at, current_bid, click_count,
        created_at, updated_at
      ) values (
        v_id, null, v_brand, v_name, v_slug, v_logo, v_color, v_website, v_description, p_category, '{}',
        'draft', null, null, 0, 0,
        v_now, v_now
      );
  end;

  return jsonb_build_object(
    'id', v_id,
    'slug', v_slug,
    'status', 'draft',
    'current_bid', 0,
    'listing_starts_at', null
  );
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
begin
  raise exception 'Listings start through checkout.';
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
  v_listing boolean;
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

  v_listing := coalesce(v_payment.kind, 'bid') = 'listing';

  if v_listing then
    if v_product.status = 'active'
       and v_product.listing_starts_at is not null
       and (v_product.listing_ends_at is null or v_product.listing_ends_at > v_now) then
      select b.id into v_bid_id
      from public.attention_bids b
      where b.product_id = v_payment.product_id
      order by b.created_at asc
      limit 1;
      update public.attention_bid_payments
      set status = 'applied',
          applied_bid_id = coalesce(applied_bid_id, v_bid_id)
      where id = v_payment.id;
      return jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'reason', 'already_applied',
        'payment_id', v_payment.id,
        'bid_id', coalesce(v_payment.applied_bid_id, v_bid_id)
      );
    end if;

    if v_product.status is distinct from 'draft' then
      return jsonb_build_object('ok', false, 'reason', 'product_inactive', 'payment_id', v_payment.id);
    end if;

    v_new := v_payment.increment;
    if v_new is null or v_new < 2 or v_new > 100000 then
      return jsonb_build_object('ok', false, 'reason', 'bid_cap', 'payment_id', v_payment.id);
    end if;

    insert into public.attention_bids (product_id, bidder_id, amount, created_at)
    values (v_payment.product_id, null, v_new, v_now)
    returning id into v_bid_id;

    update public.attention_products
    set status = 'active',
        listing_starts_at = v_now,
        listing_ends_at = null,
        current_bid = v_new,
        updated_at = v_now
    where id = v_payment.product_id;

    v_rank := public.attention_resulting_rank(v_payment.product_id, v_new, v_now);

    insert into public.attention_activity (product_id, type, amount, rank, created_at)
    values (v_payment.product_id, 'listing', v_new, v_rank, v_now);

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
  end if;

  if v_product.status is distinct from 'active'
     or v_product.listing_starts_at is null
     or v_product.listing_starts_at > v_now
     or (v_product.listing_ends_at is not null and v_product.listing_ends_at <= v_now) then
    return jsonb_build_object('ok', false, 'reason', 'product_inactive', 'payment_id', v_payment.id);
  end if;

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

revoke all on function public.create_pending_attention_listing(text, text, text, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.create_pending_attention_listing(text, text, text, text, text, text, integer, text) to service_role;

revoke all on function public.publish_attention_listing(text, text, text, text, text, text, integer, text, text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.publish_attention_listing(text, text, text, text, text, text, integer, text, text, text, text, numeric) to service_role;

revoke all on function public.apply_paid_attention_bid(uuid) from public, anon, authenticated;
grant execute on function public.apply_paid_attention_bid(uuid) to service_role;

revoke all on function public.place_attention_bid(uuid, integer) from public, anon, authenticated;
