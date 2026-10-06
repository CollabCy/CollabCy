-- Brand-page clicks are separate from attention_products.click_count (website visits).
create table if not exists public.attention_brand_clicks (
 product_id uuid primary key references public.attention_products(id) on delete cascade,
 click_count bigint not null default 0 check (click_count >= 0)
);
alter table public.attention_brand_clicks enable row level security;
revoke all on public.attention_brand_clicks from anon, authenticated;
create or replace function public.record_attention_brand_click(p_product_id uuid)
returns bigint language plpgsql security definer set search_path=public as $$
declare v_count bigint;
begin
 insert into public.attention_brand_clicks(product_id,click_count) values(p_product_id,1)
 on conflict(product_id) do update set click_count=attention_brand_clicks.click_count+1
 returning click_count into v_count;
 return v_count;
end;
$$;
create or replace function public.get_attention_brand_clicks(p_product_ids uuid[])
returns table(product_id uuid,click_count bigint) language sql stable security definer set search_path=public as $$
 select c.product_id,c.click_count from public.attention_brand_clicks c where c.product_id=any(p_product_ids);
$$;
revoke all on function public.record_attention_brand_click(uuid) from public;
revoke all on function public.get_attention_brand_clicks(uuid[]) from public;
grant execute on function public.record_attention_brand_click(uuid) to anon, authenticated;
grant execute on function public.get_attention_brand_clicks(uuid[]) to anon, authenticated;
