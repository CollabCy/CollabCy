-- Open public creator/brand directories, same-role networking connections,
-- and creator verification. Campaign listing remains free (no payment gate).
-- Does not alter Attention Marketplace, deal payments, or OAuth.

-- ---------------------------------------------------------------------------
-- Creator verification
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists verification_status text not null default 'not_requested';

alter table public.profiles
  add column if not exists verification_rejection_reason text not null default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_verification_status_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_verification_status_check
      check (verification_status in ('not_requested', 'pending', 'approved', 'rejected'));
  end if;
end $$;

create table if not exists public.creator_verification_requests (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null,
  rejection_reason text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists creator_verification_requests_creator_id_idx
  on public.creator_verification_requests (creator_id, submitted_at desc);

create unique index if not exists creator_verification_requests_one_pending_idx
  on public.creator_verification_requests (creator_id)
  where status = 'pending';

create index if not exists profiles_public_creators_idx
  on public.profiles (user_id)
  where role = 'creator' and verification_status = 'approved';

create index if not exists profiles_public_brands_idx
  on public.profiles (user_id)
  where role = 'brand';

create or replace function public.set_creator_verification_requests_updated_at()
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

drop trigger if exists creator_verification_requests_set_updated_at on public.creator_verification_requests;
create trigger creator_verification_requests_set_updated_at
before update on public.creator_verification_requests
for each row
execute procedure public.set_creator_verification_requests_updated_at();

alter table public.creator_verification_requests enable row level security;

drop policy if exists "creator_verification_requests_select_own" on public.creator_verification_requests;
create policy "creator_verification_requests_select_own"
  on public.creator_verification_requests
  for select
  to authenticated
  using (auth.uid() = creator_id);

drop policy if exists "creator_verification_requests_select_verifier" on public.creator_verification_requests;
create policy "creator_verification_requests_select_verifier"
  on public.creator_verification_requests
  for select
  to authenticated
  using (public.is_platform_verifier());

revoke all on table public.creator_verification_requests from anon, public, authenticated;
grant select on table public.creator_verification_requests to authenticated;

create or replace function public.protect_profile_verification_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if current_setting('collabcy.verification_write', true) is distinct from 'allowed' then
      new.verification_status := 'not_requested';
      new.verification_rejection_reason := '';
    end if;
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status
     or new.verification_rejection_reason is distinct from old.verification_rejection_reason then
    if current_setting('collabcy.verification_write', true) is distinct from 'allowed' then
      new.verification_status := old.verification_status;
      new.verification_rejection_reason := old.verification_rejection_reason;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_verification on public.profiles;
create trigger profiles_protect_verification
before insert or update on public.profiles
for each row
execute procedure public.protect_profile_verification_columns();

revoke all on function public.protect_profile_verification_columns() from public, anon, authenticated;

create or replace function public.creator_is_publicly_listed(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = target_user_id
      and role = 'creator'
      and verification_status = 'approved'
  );
$$;

revoke all on function public.creator_is_publicly_listed(uuid) from public;
grant execute on function public.creator_is_publicly_listed(uuid) to authenticated;

create or replace function public.brand_is_publicly_listed(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where user_id = target_user_id
      and role = 'brand'
      and length(trim(name)) > 0
  );
$$;

revoke all on function public.brand_is_publicly_listed(uuid) from public;
grant execute on function public.brand_is_publicly_listed(uuid) to authenticated;

-- Directories are for authenticated Brand and Creator accounts. This helper
-- no longer depends on campaign count.
create or replace function public.current_brand_can_browse_creators()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null;
$$;

revoke all on function public.current_brand_can_browse_creators() from public;
grant execute on function public.current_brand_can_browse_creators() to authenticated;

-- ---------------------------------------------------------------------------
-- Public directories
-- ---------------------------------------------------------------------------

drop policy if exists "social_accounts_select_discoverable" on public.social_accounts;
create policy "social_accounts_select_discoverable"
  on public.social_accounts
  for select
  to authenticated
  using (public.creator_is_publicly_listed(social_accounts.user_id));

revoke all on table public.social_accounts from anon;
grant select on table public.social_accounts to authenticated;

drop view if exists public.public_creators;
create view public.public_creators
with (security_invoker = false)
as
select
  p.user_id,
  p.role,
  p.name,
  p.bio,
  p.handle,
  p.website,
  p.niche,
  p.platforms,
  p.followers,
  p.impressions,
  p.rate,
  p.location,
  p.available,
  p.avatar,
  p.portfolio,
  p.created_at
from public.profiles p
where p.role = 'creator'
  and p.verification_status = 'approved';

comment on view public.public_creators is
  'Authenticated creator directory. Approved creators only. Omits email and auth metadata. Guests cannot select.';

revoke all on public.public_creators from public, anon;
grant select on public.public_creators to authenticated;

drop view if exists public.public_brands;
create view public.public_brands
with (security_invoker = false)
as
select
  p.user_id,
  p.role,
  p.name,
  p.bio,
  p.handle,
  p.website,
  p.niche,
  p.platforms,
  p.location,
  p.avatar,
  p.portfolio,
  p.created_at
from public.profiles p
where p.role = 'brand'
  and length(trim(p.name)) > 0;

comment on view public.public_brands is
  'Authenticated brand directory. Omits email, billing, and private campaign fields. Guests cannot select.';

revoke all on public.public_brands from public, anon;
grant select on public.public_brands to authenticated;

-- ---------------------------------------------------------------------------
-- Notifications for verification
-- ---------------------------------------------------------------------------

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'new_message',
    'application_received',
    'application_accepted',
    'application_rejected',
    'connection_created',
    'deal_submitted',
    'deal_revision_requested',
    'deal_completed',
    'deal_cancelled',
    'deal_brand_verified',
    'deal_platform_verified',
    'deal_platform_revision',
    'deal_needs_verification',
    'deal_disputed',
    'deal_dispute_resolved',
    'creator_verification_requested',
    'creator_verification_approved',
    'creator_verification_rejected'
  ));

-- ---------------------------------------------------------------------------
-- Same-role / campaign-optional networking connections
-- ---------------------------------------------------------------------------

alter table public.connections
  add column if not exists kind text not null default 'collaboration';

alter table public.connections
  add column if not exists requested_by uuid references auth.users (id) on delete set null;

alter table public.connections
  add column if not exists party_a_name text not null default '';

alter table public.connections
  add column if not exists party_a_handle text not null default '';

alter table public.connections
  add column if not exists party_a_avatar text;

alter table public.connections
  add column if not exists party_b_name text not null default '';

alter table public.connections
  add column if not exists party_b_handle text not null default '';

alter table public.connections
  add column if not exists party_b_avatar text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'connections_kind_check'
      and conrelid = 'public.connections'::regclass
  ) then
    alter table public.connections
      add constraint connections_kind_check
      check (kind in ('collaboration', 'network'));
  end if;
end $$;

alter table public.connections alter column campaign_id drop not null;
alter table public.conversations alter column campaign_id drop not null;

-- Keep unique (campaign_id, creator_id) so existing ON CONFLICT collaboration
-- inserts still work. NULLs do not collide, so network rows remain allowed.

create unique index if not exists connections_network_pair_uidx
  on public.connections (least(brand_id, creator_id), greatest(brand_id, creator_id))
  where kind = 'network' and status = 'active';

drop trigger if exists connections_brand_creator_only on public.connections;
drop trigger if exists conversations_brand_creator_only on public.conversations;

create or replace function public.enforce_distinct_connection_parties()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.brand_id is null or new.creator_id is null or new.brand_id = new.creator_id then
    raise exception 'Connections must be between two different accounts';
  end if;
  if not exists (select 1 from public.profiles where user_id = new.brand_id) then
    raise exception 'Account not found';
  end if;
  if not exists (select 1 from public.profiles where user_id = new.creator_id) then
    raise exception 'Account not found';
  end if;
  if new.kind = 'collaboration' then
    if new.campaign_id is null then
      raise exception 'Campaign collaborations require a campaign';
    end if;
    if not public.profile_has_role(new.brand_id, 'brand')
       or not public.profile_has_role(new.creator_id, 'creator') then
      raise exception 'Campaign collaborations must be between a Brand and a Creator';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists connections_distinct_parties on public.connections;
create trigger connections_distinct_parties
before insert on public.connections
for each row
execute procedure public.enforce_distinct_connection_parties();

revoke all on function public.enforce_distinct_connection_parties() from public, anon, authenticated;

create or replace function public.enforce_distinct_conversation_parties()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.brand_id is null or new.creator_id is null or new.brand_id = new.creator_id then
    raise exception 'Connections must be between two different accounts';
  end if;
  return new;
end;
$$;

drop trigger if exists conversations_distinct_parties on public.conversations;
create trigger conversations_distinct_parties
before insert on public.conversations
for each row
execute procedure public.enforce_distinct_conversation_parties();

revoke all on function public.enforce_distinct_conversation_parties() from public, anon, authenticated;

create or replace function public.internal_ensure_conversation(target_connection_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conn public.connections%rowtype;
  app public.campaign_applications%rowtype;
  camp public.campaigns%rowtype;
  conv_id uuid;
  v_creator_name text := '';
  v_creator_handle text := '';
  v_creator_avatar text;
  v_brand_name text := '';
  v_campaign_title text := '';
  v_campaign_brand text := '';
  v_campaign_color text := '#e8edff';
  requester public.profiles%rowtype;
  target public.profiles%rowtype;
begin
  select * into conn from public.connections where id = target_connection_id;
  if not found then
    raise exception 'Connection not found';
  end if;

  select id into conv_id from public.conversations where connection_id = conn.id;
  if conv_id is not null then
    return conv_id;
  end if;

  if conn.brand_id = conn.creator_id then
    return null;
  end if;

  if conn.application_id is not null then
    select * into app from public.campaign_applications where id = conn.application_id;
  end if;
  if conn.campaign_id is not null then
    select * into camp from public.campaigns where id = conn.campaign_id;
  end if;

  v_creator_name := coalesce(nullif(conn.party_b_name, ''), app.creator_name, '');
  v_creator_handle := coalesce(nullif(conn.party_b_handle, ''), app.creator_handle, '');
  v_creator_avatar := coalesce(conn.party_b_avatar, app.creator_avatar);
  v_brand_name := coalesce(nullif(conn.party_a_name, ''), app.campaign_brand, camp.brand_name, '');
  v_campaign_title := coalesce(nullif(app.campaign_title, ''), camp.title, '');
  v_campaign_brand := coalesce(nullif(app.campaign_brand, ''), camp.brand_name, v_brand_name, '');
  v_campaign_color := coalesce(nullif(app.campaign_color, ''), camp.color, '#e8edff');

  if v_creator_name = '' or v_brand_name = '' then
    select * into requester from public.profiles where user_id = conn.brand_id limit 1;
    select * into target from public.profiles where user_id = conn.creator_id limit 1;
    if v_brand_name = '' then
      v_brand_name := coalesce(requester.name, '');
    end if;
    if v_creator_name = '' then
      v_creator_name := coalesce(target.name, '');
      v_creator_handle := coalesce(nullif(v_creator_handle, ''), target.handle, '');
      v_creator_avatar := coalesce(v_creator_avatar, target.avatar);
    end if;
  end if;

  if v_campaign_title = '' then
    v_campaign_title := 'Connection';
  end if;
  if v_campaign_brand = '' then
    v_campaign_brand := v_brand_name;
  end if;

  insert into public.conversations (
    connection_id, brand_id, creator_id, campaign_id,
    campaign_title, campaign_brand, campaign_color,
    creator_name, creator_handle, creator_avatar, brand_name
  ) values (
    conn.id, conn.brand_id, conn.creator_id, conn.campaign_id,
    v_campaign_title, v_campaign_brand, v_campaign_color,
    coalesce(v_creator_name, ''), coalesce(v_creator_handle, ''), v_creator_avatar,
    coalesce(v_brand_name, v_campaign_brand, '')
  )
  on conflict (connection_id) do nothing
  returning id into conv_id;

  if conv_id is null then
    select id into conv_id from public.conversations where connection_id = conn.id;
  end if;

  return conv_id;
end;
$$;

revoke all on function public.internal_ensure_conversation(uuid) from public, anon, authenticated;

create or replace function public.ensure_conversation(target_connection_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conn public.connections%rowtype;
  conv_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into conn from public.connections where id = target_connection_id;
  if not found then
    raise exception 'Connection not found';
  end if;
  if auth.uid() is distinct from conn.brand_id
     and auth.uid() is distinct from conn.creator_id then
    raise exception 'Not allowed';
  end if;
  conv_id := public.internal_ensure_conversation(conn.id);
  if conv_id is null then
    raise exception 'Connection not found';
  end if;
  return conv_id;
end;
$$;

revoke all on function public.ensure_conversation(uuid) from public, anon;
grant execute on function public.ensure_conversation(uuid) to authenticated;

create or replace function public.internal_ensure_deal(p_connection_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conn public.connections%rowtype;
  camp public.campaigns%rowtype;
  app public.campaign_applications%rowtype;
  v_id uuid;
  v_now timestamptz := now();
begin
  if p_connection_id is null then
    return null;
  end if;

  select id into v_id from public.deals where connection_id = p_connection_id;
  if v_id is not null then
    return v_id;
  end if;

  select * into conn from public.connections where id = p_connection_id;
  if not found then
    return null;
  end if;

  if coalesce(conn.kind, 'collaboration') is distinct from 'collaboration'
     or conn.campaign_id is null then
    return null;
  end if;

  if conn.brand_id = conn.creator_id
     or not public.profile_has_role(conn.brand_id, 'brand')
     or not public.profile_has_role(conn.creator_id, 'creator') then
    return null;
  end if;

  select * into camp from public.campaigns where id = conn.campaign_id;
  if not found then
    return null;
  end if;
  if conn.application_id is not null then
    select * into app from public.campaign_applications where id = conn.application_id;
  end if;

  insert into public.deals (
    connection_id, campaign_id, creator_id, brand_id, status,
    deliverable, requirements, agreed_budget, deadline,
    started_at, created_at, updated_at
  ) values (
    conn.id,
    conn.campaign_id,
    conn.creator_id,
    conn.brand_id,
    'active',
    coalesce(nullif(camp.deliverable, ''), ''),
    coalesce(nullif(camp.requirements, ''), coalesce(app.message, '')),
    greatest(coalesce(app.proposed_rate, 0), coalesce(camp.budget, 0), 0),
    camp.expires_at,
    v_now,
    v_now,
    v_now
  )
  on conflict (connection_id) do nothing;

  select id into v_id from public.deals where connection_id = p_connection_id;
  return v_id;
end;
$$;

revoke all on function public.internal_ensure_deal(uuid) from public, anon, authenticated;

create or replace function public.notify_connection_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  title text;
  initiated text;
  recipient uuid;
  body text;
begin
  if new.kind = 'network' then
    recipient := case
      when new.requested_by is not null and new.requested_by = new.brand_id then new.creator_id
      when new.requested_by is not null and new.requested_by = new.creator_id then new.brand_id
      else new.creator_id
    end;
    insert into public.notifications (user_id, type, title, body, connection_id)
    values (
      recipient,
      'connection_created',
      'New connection',
      'You’re now connected on CollabCy.',
      new.id
    );
    return new;
  end if;

  select a.initiated_by,
         coalesce(nullif(a.campaign_title, ''), c.title, 'a campaign')
    into initiated, title
  from public.campaigns c
  left join public.campaign_applications a on a.id = new.application_id
  where c.id = new.campaign_id;

  if initiated = 'brand' then
    return new;
  end if;

  insert into public.notifications (user_id, type, title, body, connection_id)
  values (
    new.brand_id,
    'connection_created',
    'New collaboration',
    left('You’re now connected on ' || coalesce(title, 'a campaign') || '.', 180),
    new.id
  );
  return new;
end;
$$;

create or replace function public.create_network_connection(p_target_user_id uuid, p_message text default '')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  requester public.profiles%rowtype;
  target public.profiles%rowtype;
  conn_id uuid;
  body text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_target_user_id is null or p_target_user_id = auth.uid() then
    raise exception 'Choose someone to connect with';
  end if;

  select * into requester from public.profiles where user_id = auth.uid() limit 1;
  if not found then
    raise exception 'Not allowed';
  end if;
  select * into target from public.profiles where user_id = p_target_user_id limit 1;
  if not found then
    raise exception 'Account not found';
  end if;

  select id into conn_id
  from public.connections
  where status = 'active'
    and (
      (brand_id = auth.uid() and creator_id = p_target_user_id)
      or (creator_id = auth.uid() and brand_id = p_target_user_id)
    )
  order by created_at desc
  limit 1;

  if conn_id is not null then
    perform public.internal_ensure_conversation(conn_id);
    return conn_id;
  end if;

  body := trim(coalesce(p_message, ''));
  if char_length(body) > 2000 then
    raise exception 'Write a short message before sending';
  end if;

  insert into public.connections (
    campaign_id, application_id, brand_id, creator_id, status, kind, requested_by,
    party_a_name, party_a_handle, party_a_avatar,
    party_b_name, party_b_handle, party_b_avatar
  ) values (
    null, null, auth.uid(), p_target_user_id, 'active', 'network', auth.uid(),
    coalesce(requester.name, ''), coalesce(requester.handle, ''), requester.avatar,
    coalesce(target.name, ''), coalesce(target.handle, ''), target.avatar
  )
  returning id into conn_id;

  perform public.internal_ensure_conversation(conn_id);
  return conn_id;
end;
$$;

revoke all on function public.create_network_connection(uuid, text) from public, anon;
grant execute on function public.create_network_connection(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Creator verification RPCs
-- ---------------------------------------------------------------------------

create or replace function public.request_creator_verification()
returns public.creator_verification_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  creator public.profiles%rowtype;
  req public.creator_verification_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.current_user_is_creator() then
    raise exception 'Only creators can request verification';
  end if;

  select * into creator
  from public.profiles
  where user_id = auth.uid()
    and role = 'creator';
  if not found then
    raise exception 'Complete your creator profile first';
  end if;
  if length(trim(creator.name)) < 2 or length(trim(creator.bio)) < 20 then
    raise exception 'Complete your creator profile first';
  end if;
  if creator.verification_status = 'approved' then
    raise exception 'You are already verified';
  end if;
  if exists (
    select 1 from public.creator_verification_requests
    where creator_id = auth.uid()
      and status = 'pending'
  ) then
    raise exception 'Verification is already pending';
  end if;

  insert into public.creator_verification_requests (creator_id, status)
  values (auth.uid(), 'pending')
  returning * into req;

  perform set_config('collabcy.verification_write', 'allowed', true);
  update public.profiles
  set verification_status = 'pending',
      verification_rejection_reason = ''
  where user_id = auth.uid()
    and role = 'creator';

  perform public.internal_notify_platform(
    'creator_verification_requested',
    'Creator verification requested',
    left(coalesce(nullif(creator.name, ''), 'A creator') || ' asked to be verified.', 180),
    null
  );

  return req;
end;
$$;

revoke all on function public.request_creator_verification() from public, anon;
grant execute on function public.request_creator_verification() to authenticated;

create or replace function public.admin_approve_creator_verification(p_creator_id uuid)
returns public.creator_verification_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.creator_verification_requests%rowtype;
  creator public.profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_platform_verifier() then
    raise exception 'Not allowed';
  end if;
  if p_creator_id is null then
    raise exception 'Creator not found';
  end if;

  select * into creator
  from public.profiles
  where user_id = p_creator_id
    and role = 'creator';
  if not found then
    raise exception 'Creator not found';
  end if;

  select * into req
  from public.creator_verification_requests
  where creator_id = p_creator_id
    and status = 'pending'
  order by submitted_at desc
  limit 1;
  if not found then
    raise exception 'No pending verification request';
  end if;

  update public.creator_verification_requests
  set status = 'approved',
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      rejection_reason = ''
  where id = req.id
  returning * into req;

  perform set_config('collabcy.verification_write', 'allowed', true);
  update public.profiles
  set verification_status = 'approved',
      verification_rejection_reason = ''
  where user_id = p_creator_id
    and role = 'creator';

  perform public.internal_notify_deal(
    p_creator_id,
    'creator_verification_approved',
    'You’re verified on CollabCy',
    'Your creator profile is now visible in the public directory.',
    null
  );

  return req;
end;
$$;

revoke all on function public.admin_approve_creator_verification(uuid) from public, anon;
grant execute on function public.admin_approve_creator_verification(uuid) to authenticated;

create or replace function public.admin_reject_creator_verification(p_creator_id uuid, p_reason text)
returns public.creator_verification_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.creator_verification_requests%rowtype;
  creator public.profiles%rowtype;
  reason text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_platform_verifier() then
    raise exception 'Not allowed';
  end if;
  if p_creator_id is null then
    raise exception 'Creator not found';
  end if;

  reason := trim(coalesce(p_reason, ''));
  if char_length(reason) < 8 or char_length(reason) > 1000 then
    raise exception 'A rejection reason is required';
  end if;

  select * into creator
  from public.profiles
  where user_id = p_creator_id
    and role = 'creator';
  if not found then
    raise exception 'Creator not found';
  end if;

  select * into req
  from public.creator_verification_requests
  where creator_id = p_creator_id
    and status = 'pending'
  order by submitted_at desc
  limit 1;
  if not found then
    raise exception 'No pending verification request';
  end if;

  update public.creator_verification_requests
  set status = 'rejected',
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      rejection_reason = reason
  where id = req.id
  returning * into req;

  perform set_config('collabcy.verification_write', 'allowed', true);
  update public.profiles
  set verification_status = 'rejected',
      verification_rejection_reason = reason
  where user_id = p_creator_id
    and role = 'creator';

  perform public.internal_notify_deal(
    p_creator_id,
    'creator_verification_rejected',
    'Verification was not approved',
    left(reason, 180),
    null
  );

  return req;
end;
$$;

revoke all on function public.admin_reject_creator_verification(uuid, text) from public, anon;
grant execute on function public.admin_reject_creator_verification(uuid, text) to authenticated;

create or replace function public.list_creator_verification_queue(p_filter text default 'pending')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_platform_verifier() then
    raise exception 'Not allowed';
  end if;

  return coalesce((
    select jsonb_agg(to_jsonb(item) order by item.submitted_at desc)
    from (
      select
        r.id,
        r.creator_id,
        r.status,
        r.submitted_at,
        r.reviewed_at,
        r.reviewed_by,
        r.rejection_reason,
        p.name,
        p.bio,
        p.handle,
        p.website,
        p.niche,
        p.platforms,
        p.followers,
        p.impressions,
        p.rate,
        p.location,
        p.available,
        p.avatar,
        p.portfolio
      from public.creator_verification_requests r
      join public.profiles p
        on p.user_id = r.creator_id
       and p.role = 'creator'
      where (
        coalesce(p_filter, 'pending') = 'all'
        or (coalesce(p_filter, 'pending') = 'pending' and r.status = 'pending')
        or (p_filter = 'reviewed' and r.status in ('approved', 'rejected'))
      )
    ) item
  ), '[]'::jsonb);
end;
$$;

revoke all on function public.list_creator_verification_queue(text) from public, anon;
grant execute on function public.list_creator_verification_queue(text) to authenticated;
