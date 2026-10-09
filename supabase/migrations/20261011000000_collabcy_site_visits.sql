-- PREPARED ONLY: do not apply without approval. No historical visits are seeded.
-- Separate from product outbound clicks, payments, and marketplace ranking.
begin;
create table public.collabcy_site_visit_totals (
  singleton boolean primary key default true check (singleton),
  total bigint not null default 0 check (total >= 0),
  tracking_began_at timestamptz
);
insert into public.collabcy_site_visit_totals(singleton) values (true);
create table public.collabcy_site_visit_sessions (
  visit_id uuid primary key,
  counted_at timestamptz not null default now()
);
alter table public.collabcy_site_visit_totals enable row level security;
alter table public.collabcy_site_visit_sessions enable row level security;
revoke all on public.collabcy_site_visit_totals, public.collabcy_site_visit_sessions from public, anon, authenticated;

create function public.get_collabcy_site_visits() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('totalVisits',total::text,'trackingBeganAt',tracking_began_at)
  from public.collabcy_site_visit_totals where singleton;
$$;

create function public.record_collabcy_site_visit(p_visit_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare inserted integer;
begin
  if p_visit_id is null then raise exception 'Visit ID required'; end if;
  insert into public.collabcy_site_visit_sessions(visit_id) values(p_visit_id)
    on conflict (visit_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 1 then
    update public.collabcy_site_visit_totals set total=total+1,
      tracking_began_at=coalesce(tracking_began_at,now()) where singleton;
  end if;
  return public.get_collabcy_site_visits();
end;
$$;
revoke all on function public.get_collabcy_site_visits() from public, anon, authenticated;
revoke all on function public.record_collabcy_site_visit(uuid) from public, anon, authenticated;
grant execute on function public.get_collabcy_site_visits() to service_role;
grant execute on function public.record_collabcy_site_visit(uuid) to service_role;
commit;
