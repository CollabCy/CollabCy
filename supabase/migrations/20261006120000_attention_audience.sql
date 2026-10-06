-- Anonymous aggregate audience count. No emails, IP addresses, or user profiles.
create table if not exists public.attention_audience (
 visitor_id uuid primary key,
 first_seen timestamptz not null default now()
);
alter table public.attention_audience enable row level security;
revoke all on public.attention_audience from anon, authenticated;
create or replace function public.record_attention_audience(p_visitor uuid)
returns bigint language plpgsql security definer set search_path=public as $$
begin
 insert into public.attention_audience(visitor_id) values(p_visitor) on conflict do nothing;
 return (select count(*) from public.attention_audience);
end;
$$;
revoke all on function public.record_attention_audience(uuid) from public;
grant execute on function public.record_attention_audience(uuid) to anon, authenticated;
