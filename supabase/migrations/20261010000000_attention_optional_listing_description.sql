-- Attention Marketplace: allow an empty product description on paid listing checkout.
-- Local implementation file. Do not apply to production unless explicitly requested.
-- Does not change Dodo webhook, claim/apply, or bid payment behavior.

alter table public.attention_products
  drop constraint if exists attention_products_description_len;

alter table public.attention_products
  add constraint attention_products_description_len
  check (char_length(coalesce(description, '')) <= 500);

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

  if v_name = '' or char_length(v_name) > 80 or char_length(v_description) > 500 then
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

revoke all on function public.create_pending_attention_listing(text, text, text, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.create_pending_attention_listing(text, text, text, text, text, text, integer, text) to service_role;
