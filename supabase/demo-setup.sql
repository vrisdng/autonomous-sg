-- Bojio demo database setup
-- Generated from supabase/migrations in filename order.
-- Run once on a new, empty Supabase project using the SQL Editor.
-- Do not run on a project with existing Bojio tables; use the individual migrations instead.

-- BEGIN 202609140001_create_collaborative_plans.sql
create extension if not exists pgcrypto with schema extensions;

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  host_token_hash text not null,
  chosen_venue_id text,
  status text not null default 'planning' check (status in ('planning', 'confirmed', 'closed')),
  expires_at timestamptz not null default (now() + interval '30 days'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.participants (
  plan_id uuid not null references public.plans(id) on delete cascade,
  id text not null,
  display_name text not null check (char_length(display_name) between 1 and 80),
  origin text not null check (char_length(origin) between 1 and 120),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (plan_id, id)
);

create table public.venues (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  provider text not null default 'prototype',
  provider_place_id text,
  name text not null,
  area text,
  latitude double precision,
  longitude double precision,
  opening_hours jsonb,
  source_timestamp timestamptz,
  created_at timestamptz not null default now()
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  restaurant text,
  service_percent numeric(6, 3) not null default 10 check (service_percent >= 0),
  gst_percent numeric(6, 3) not null default 9 check (gst_percent >= 0),
  status text not null default 'claiming' check (status in ('claiming', 'settled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  quantity integer not null default 1 check (quantity > 0),
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  bill_item_id uuid not null references public.bill_items(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete cascade,
  participant_id text not null,
  shares integer not null default 1 check (shares > 0),
  created_at timestamptz not null default now(),
  unique (bill_item_id, participant_id),
  foreign key (plan_id, participant_id) references public.participants(plan_id, id) on delete cascade
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger plans_set_updated_at before update on public.plans
for each row execute function public.set_updated_at();

create trigger participants_set_updated_at before update on public.participants
for each row execute function public.set_updated_at();

create trigger bills_set_updated_at before update on public.bills
for each row execute function public.set_updated_at();

alter table public.plans enable row level security;
alter table public.participants enable row level security;
alter table public.venues enable row level security;
alter table public.bills enable row level security;
alter table public.bill_items enable row level security;
alter table public.claims enable row level security;

create or replace function public.plan_payload(p_plan_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'code', plan.code,
    'chosen_venue_id', plan.chosen_venue_id,
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', participant.id, 'name', participant.display_name, 'origin', participant.origin)
        order by participant.position, participant.created_at
      )
      from public.participants participant
      where participant.plan_id = plan.id
    ), '[]'::jsonb)
  )
  from public.plans plan
  where plan.id = p_plan_id;
$$;

create or replace function public.create_plan(
  p_code text,
  p_host_token text,
  p_participants jsonb,
  p_chosen_venue_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_plan_id uuid;
begin
  p_code := upper(trim(p_code));
  if p_code !~ '^[A-HJ-NP-Z2-9]{6}$' then
    raise exception 'Invalid plan code';
  end if;
  if char_length(p_host_token) < 32 then
    raise exception 'Invalid host capability';
  end if;
  if jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) < 2 then
    raise exception 'A plan needs at least two participants';
  end if;

  insert into public.plans (code, host_token_hash, chosen_venue_id)
  values (p_code, encode(extensions.digest(p_host_token, 'sha256'), 'hex'), nullif(trim(p_chosen_venue_id), ''))
  returning id into new_plan_id;

  insert into public.participants (plan_id, id, display_name, origin, position)
  select new_plan_id, participant.id, trim(participant.name), trim(participant.origin), (participant.ordinality - 1)::integer
  from rows from (
    jsonb_to_recordset(p_participants) as (id text, name text, origin text)
  ) with ordinality as participant(id, name, origin, ordinality)
  where trim(participant.id) <> '' and trim(participant.name) <> '' and trim(participant.origin) <> '';

  if (select count(*) from public.participants where plan_id = new_plan_id) <> jsonb_array_length(p_participants) then
    raise exception 'Every participant needs a unique id, name, and origin';
  end if;

  return public.plan_payload(new_plan_id);
end;
$$;

create or replace function public.get_plan(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  found_plan_id uuid;
begin
  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code)) and expires_at > now() and status <> 'closed';
  if found_plan_id is null then
    raise exception 'This plan is unavailable or has expired';
  end if;
  return public.plan_payload(found_plan_id);
end;
$$;

create or replace function public.update_plan(
  p_code text,
  p_host_token text,
  p_participants jsonb,
  p_chosen_venue_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
begin
  if jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) < 2 then
    raise exception 'A plan needs at least two participants';
  end if;

  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex')
    and expires_at > now();
  if found_plan_id is null then
    raise exception 'Plan not found or host capability is invalid';
  end if;

  update public.plans set chosen_venue_id = nullif(trim(p_chosen_venue_id), '') where id = found_plan_id;
  delete from public.participants where plan_id = found_plan_id;
  insert into public.participants (plan_id, id, display_name, origin, position)
  select found_plan_id, participant.id, trim(participant.name), trim(participant.origin), (participant.ordinality - 1)::integer
  from rows from (
    jsonb_to_recordset(p_participants) as (id text, name text, origin text)
  ) with ordinality as participant(id, name, origin, ordinality)
  where trim(participant.id) <> '' and trim(participant.name) <> '' and trim(participant.origin) <> '';

  if (select count(*) from public.participants where plan_id = found_plan_id) <> jsonb_array_length(p_participants) then
    raise exception 'Every participant needs a unique id, name, and origin';
  end if;
  return public.plan_payload(found_plan_id);
end;
$$;

revoke all on public.plans, public.participants, public.venues, public.bills, public.bill_items, public.claims from anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.plan_payload(uuid) from public, anon, authenticated;
revoke execute on function public.create_plan(text, text, jsonb, text) from public;
revoke execute on function public.get_plan(text) from public;
revoke execute on function public.update_plan(text, text, jsonb, text) from public;
grant execute on function public.create_plan(text, text, jsonb, text) to anon, authenticated;
grant execute on function public.get_plan(text) to anon, authenticated;
grant execute on function public.update_plan(text, text, jsonb, text) to anon, authenticated;
-- END 202609140001_create_collaborative_plans.sql

-- BEGIN 202609140002_add_guest_participation.sql
alter table public.participants
add column guest_token_hash text;

create unique index participants_guest_token_per_plan
on public.participants (plan_id, guest_token_hash)
where guest_token_hash is not null;

create or replace function public.update_plan(
  p_code text,
  p_host_token text,
  p_participants jsonb,
  p_chosen_venue_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
begin
  if jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) < 2 then
    raise exception 'A plan needs at least two participants';
  end if;

  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex')
    and expires_at > now();
  if found_plan_id is null then
    raise exception 'Plan not found or host capability is invalid';
  end if;

  update public.plans set chosen_venue_id = nullif(trim(p_chosen_venue_id), '') where id = found_plan_id;

  delete from public.participants existing
  where existing.plan_id = found_plan_id
    and not exists (
      select 1
      from jsonb_to_recordset(p_participants) as incoming(id text)
      where incoming.id = existing.id
    );

  insert into public.participants (plan_id, id, display_name, origin, position)
  select found_plan_id, participant.id, trim(participant.name), trim(participant.origin), (participant.ordinality - 1)::integer
  from rows from (
    jsonb_to_recordset(p_participants) as (id text, name text, origin text)
  ) with ordinality as participant(id, name, origin, ordinality)
  where trim(participant.id) <> '' and trim(participant.name) <> '' and trim(participant.origin) <> ''
  on conflict (plan_id, id) do update
  set display_name = excluded.display_name,
      origin = excluded.origin,
      position = excluded.position;

  if (select count(*) from public.participants where plan_id = found_plan_id) <> jsonb_array_length(p_participants) then
    raise exception 'Every participant needs a unique id, name, and origin';
  end if;
  return public.plan_payload(found_plan_id);
end;
$$;

create or replace function public.upsert_guest_participant(
  p_code text,
  p_guest_token text,
  p_display_name text,
  p_origin text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
  found_participant_id text;
  token_hash text;
begin
  if char_length(p_guest_token) < 32 then
    raise exception 'Invalid guest capability';
  end if;
  p_display_name := trim(p_display_name);
  p_origin := trim(p_origin);
  if char_length(p_display_name) not between 1 and 80 or char_length(p_origin) not between 1 and 120 then
    raise exception 'A guest needs a name and origin';
  end if;

  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code)) and expires_at > now() and status = 'planning';
  if found_plan_id is null then
    raise exception 'This plan is unavailable, closed, or has expired';
  end if;

  token_hash := encode(extensions.digest(p_guest_token, 'sha256'), 'hex');
  select id into found_participant_id
  from public.participants
  where plan_id = found_plan_id and guest_token_hash = token_hash;

  if found_participant_id is null then
    found_participant_id := pg_catalog.gen_random_uuid()::text;
    insert into public.participants (plan_id, id, display_name, origin, position, guest_token_hash)
    values (
      found_plan_id,
      found_participant_id,
      p_display_name,
      p_origin,
      coalesce((select max(position) + 1 from public.participants where plan_id = found_plan_id), 0),
      token_hash
    );
  else
    update public.participants
    set display_name = p_display_name, origin = p_origin
    where plan_id = found_plan_id and id = found_participant_id;
  end if;

  return public.plan_payload(found_plan_id) || jsonb_build_object('participant_id', found_participant_id);
end;
$$;

revoke execute on function public.upsert_guest_participant(text, text, text, text) from public;
grant execute on function public.upsert_guest_participant(text, text, text, text) to anon, authenticated;
-- END 202609140002_add_guest_participation.sql

-- BEGIN 202609140003_add_plan_realtime.sql
create or replace function public.broadcast_plan_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_plan_id uuid;
  affected_plan_code text;
begin
  if tg_table_name = 'plans' then
    affected_plan_code := case when tg_op = 'DELETE' then old.code else new.code end;
  else
    affected_plan_id := case when tg_op = 'DELETE' then old.plan_id else new.plan_id end;
    select code into affected_plan_code from public.plans where id = affected_plan_id;
  end if;

  if affected_plan_code is not null then
    perform realtime.send(
      jsonb_build_object('changed_at', pg_catalog.clock_timestamp()),
      'plan_changed',
      'plan:' || affected_plan_code,
      false
    );
  end if;
  return null;
end;
$$;

create trigger plans_broadcast_invalidation
after insert or update or delete on public.plans
for each row execute function public.broadcast_plan_invalidation();

create trigger participants_broadcast_invalidation
after insert or update or delete on public.participants
for each row execute function public.broadcast_plan_invalidation();

revoke execute on function public.broadcast_plan_invalidation() from public, anon, authenticated;
-- END 202609140003_add_plan_realtime.sql

-- BEGIN 202609140004_add_collaborative_bills.sql
alter table public.bill_items
add column client_id text;

update public.bill_items set client_id = id::text where client_id is null;
alter table public.bill_items alter column client_id set not null;
create unique index bill_items_client_id_per_bill on public.bill_items (bill_id, client_id);

create or replace function public.bill_payload(p_plan_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'exists', true,
    'service_percent', bill.service_percent,
    'gst_percent', bill.gst_percent,
    'status', bill.status,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.client_id,
          'name', item.name,
          'price_cents', item.price_cents,
          'claimant_ids', coalesce((
            select jsonb_agg(claim.participant_id order by claim.created_at)
            from public.claims claim
            where claim.bill_item_id = item.id
          ), '[]'::jsonb)
        ) order by item.position, item.created_at
      )
      from public.bill_items item
      where item.bill_id = bill.id
    ), '[]'::jsonb)
  )
  from public.bills bill
  where bill.plan_id = p_plan_id
  order by bill.created_at desc
  limit 1;
$$;

create or replace function public.get_bill(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  found_plan_id uuid;
begin
  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code)) and expires_at > now() and status <> 'closed';
  if found_plan_id is null then
    raise exception 'This plan is unavailable or has expired';
  end if;
  return coalesce(public.bill_payload(found_plan_id), jsonb_build_object('exists', false));
end;
$$;

create or replace function public.save_bill(
  p_code text,
  p_host_token text,
  p_service_percent numeric,
  p_gst_percent numeric,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
  found_bill_id uuid;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'A bill must contain at most 200 items';
  end if;
  if p_service_percent < 0 or p_gst_percent < 0 then
    raise exception 'Bill rates cannot be negative';
  end if;

  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex')
    and expires_at > now() and status <> 'closed';
  if found_plan_id is null then
    raise exception 'Plan not found or host capability is invalid';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where coalesce(trim(item->>'id'), '') = ''
      or coalesce(trim(item->>'name'), '') = ''
      or coalesce((item->>'price_cents')::integer, -1) < 0
      or jsonb_typeof(coalesce(item->'claimant_ids', '[]'::jsonb)) <> 'array'
  ) then
    raise exception 'Every bill item needs an id, name, non-negative price, and claimant list';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    cross join lateral jsonb_array_elements_text(coalesce(item->'claimant_ids', '[]'::jsonb)) claimant(participant_id)
    left join public.participants participant
      on participant.plan_id = found_plan_id and participant.id = claimant.participant_id
    where participant.id is null
  ) then
    raise exception 'A claim references someone outside this plan';
  end if;

  select id into found_bill_id
  from public.bills
  where plan_id = found_plan_id
  order by created_at desc
  limit 1;

  if found_bill_id is null then
    insert into public.bills (plan_id, service_percent, gst_percent)
    values (found_plan_id, p_service_percent, p_gst_percent)
    returning id into found_bill_id;
  else
    update public.bills
    set service_percent = p_service_percent, gst_percent = p_gst_percent, status = 'claiming'
    where id = found_bill_id;
    delete from public.bill_items where bill_id = found_bill_id;
  end if;

  insert into public.bill_items (bill_id, client_id, name, price_cents, position)
  select found_bill_id, item->>'id', trim(item->>'name'), (item->>'price_cents')::integer, (item.ordinality - 1)::integer
  from jsonb_array_elements(p_items) with ordinality item(item, ordinality);

  insert into public.claims (bill_item_id, plan_id, participant_id)
  select bill_item.id, found_plan_id, claimant.participant_id
  from jsonb_array_elements(p_items) item
  join public.bill_items bill_item
    on bill_item.bill_id = found_bill_id and bill_item.client_id = item->>'id'
  cross join lateral jsonb_array_elements_text(coalesce(item->'claimant_ids', '[]'::jsonb)) claimant(participant_id)
  on conflict (bill_item_id, participant_id) do nothing;

  update public.bills set updated_at = now() where id = found_bill_id;
  return public.bill_payload(found_plan_id);
end;
$$;

create or replace function public.set_bill_claim(
  p_code text,
  p_guest_token text,
  p_item_id text,
  p_claimed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
  found_participant_id text;
  found_bill_item_id uuid;
begin
  if char_length(p_guest_token) < 32 then
    raise exception 'Invalid guest capability';
  end if;

  select plan.id, participant.id into found_plan_id, found_participant_id
  from public.plans plan
  join public.participants participant on participant.plan_id = plan.id
  where plan.code = upper(trim(p_code))
    and plan.expires_at > now() and plan.status <> 'closed'
    and participant.guest_token_hash = encode(extensions.digest(p_guest_token, 'sha256'), 'hex');
  if found_participant_id is null then
    raise exception 'Guest capability is invalid for this plan';
  end if;

  select item.id into found_bill_item_id
  from public.bill_items item
  join public.bills bill on bill.id = item.bill_id
  where bill.plan_id = found_plan_id and bill.status = 'claiming' and item.client_id = p_item_id
  order by bill.created_at desc
  limit 1;
  if found_bill_item_id is null then
    raise exception 'This bill item is unavailable';
  end if;

  if p_claimed then
    insert into public.claims (bill_item_id, plan_id, participant_id)
    values (found_bill_item_id, found_plan_id, found_participant_id)
    on conflict (bill_item_id, participant_id) do nothing;
  else
    delete from public.claims
    where bill_item_id = found_bill_item_id and plan_id = found_plan_id and participant_id = found_participant_id;
  end if;

  return public.bill_payload(found_plan_id);
end;
$$;

create trigger bills_broadcast_invalidation
after insert or update or delete on public.bills
for each row execute function public.broadcast_plan_invalidation();

create trigger claims_broadcast_invalidation
after insert or update or delete on public.claims
for each row execute function public.broadcast_plan_invalidation();

revoke execute on function public.bill_payload(uuid) from public, anon, authenticated;
revoke execute on function public.get_bill(text) from public;
revoke execute on function public.save_bill(text, text, numeric, numeric, jsonb) from public;
revoke execute on function public.set_bill_claim(text, text, text, boolean) from public;
grant execute on function public.get_bill(text) to anon, authenticated;
grant execute on function public.save_bill(text, text, numeric, numeric, jsonb) to anon, authenticated;
grant execute on function public.set_bill_claim(text, text, text, boolean) to anon, authenticated;
-- END 202609140004_add_collaborative_bills.sql

-- BEGIN 202609140005_add_plan_lifecycle.sql
create or replace function public.plan_payload(p_plan_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'code', plan.code,
    'chosen_venue_id', plan.chosen_venue_id,
    'status', plan.status,
    'expires_at', plan.expires_at,
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', participant.id, 'name', participant.display_name, 'origin', participant.origin)
        order by participant.position, participant.created_at
      )
      from public.participants participant
      where participant.plan_id = plan.id
    ), '[]'::jsonb)
  )
  from public.plans plan
  where plan.id = p_plan_id;
$$;

create or replace function public.get_plan(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  found_plan_id uuid;
begin
  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code)) and expires_at > now();
  if found_plan_id is null then
    raise exception 'This plan is unavailable or has expired';
  end if;
  return public.plan_payload(found_plan_id);
end;
$$;

create or replace function public.set_plan_status(
  p_code text,
  p_host_token text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
begin
  if p_status not in ('planning', 'closed') then
    raise exception 'Invalid plan status';
  end if;
  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex');
  if found_plan_id is null then
    raise exception 'Plan not found or host capability is invalid';
  end if;
  update public.plans set status = p_status where id = found_plan_id;
  return public.plan_payload(found_plan_id);
end;
$$;

create or replace function public.extend_plan_expiry(
  p_code text,
  p_host_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
begin
  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex');
  if found_plan_id is null then
    raise exception 'Plan not found or host capability is invalid';
  end if;
  update public.plans set expires_at = now() + interval '30 days' where id = found_plan_id;
  return public.plan_payload(found_plan_id);
end;
$$;

create or replace function public.delete_plan(
  p_code text,
  p_host_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex');
  get diagnostics deleted_count = row_count;
  if deleted_count <> 1 then
    raise exception 'Plan not found or host capability is invalid';
  end if;
  return true;
end;
$$;

revoke execute on function public.set_plan_status(text, text, text) from public;
revoke execute on function public.extend_plan_expiry(text, text) from public;
revoke execute on function public.delete_plan(text, text) from public;
grant execute on function public.set_plan_status(text, text, text) to anon, authenticated;
grant execute on function public.extend_plan_expiry(text, text) to anon, authenticated;
grant execute on function public.delete_plan(text, text) to anon, authenticated;
-- END 202609140005_add_plan_lifecycle.sql

-- BEGIN 202609140006_share_live_venues.sql
create or replace function public.plan_payload(p_plan_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'code', plan.code,
    'chosen_venue_id', plan.chosen_venue_id,
    'chosen_venue', (
      select jsonb_build_object(
        'id', venue.provider_place_id,
        'name', venue.name,
        'address', venue.area,
        'latitude', venue.latitude,
        'longitude', venue.longitude,
        'detail', venue.opening_hours ->> 'detail',
        'openUntil', venue.opening_hours ->> 'openUntil',
        'isOpenNow', venue.opening_hours -> 'isOpenNow',
        'tags', coalesce(venue.opening_hours -> 'tags', '[]'::jsonb)
      )
      from public.venues venue
      where venue.plan_id = plan.id and venue.provider = 'google_places'
      order by venue.created_at desc
      limit 1
    ),
    'chosen_venue_source_timestamp', (
      select venue.source_timestamp
      from public.venues venue
      where venue.plan_id = plan.id and venue.provider = 'google_places'
      order by venue.created_at desc
      limit 1
    ),
    'status', plan.status,
    'expires_at', plan.expires_at,
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', participant.id, 'name', participant.display_name, 'origin', participant.origin)
        order by participant.position, participant.created_at
      )
      from public.participants participant
      where participant.plan_id = plan.id
    ), '[]'::jsonb)
  )
  from public.plans plan
  where plan.id = p_plan_id;
$$;

create or replace function public.set_plan_venue(
  p_code text,
  p_host_token text,
  p_venue jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
  venue_id text := trim(p_venue ->> 'providerPlaceId');
  app_venue_id text := trim(p_venue ->> 'id');
  venue_name text := trim(p_venue ->> 'name');
  venue_latitude double precision;
  venue_longitude double precision;
begin
  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex')
    and expires_at > now();
  if found_plan_id is null then
    raise exception 'Plan not found or host capability is invalid';
  end if;
  if p_venue is null or jsonb_typeof(p_venue) = 'null' then
    delete from public.venues where plan_id = found_plan_id;
    return public.plan_payload(found_plan_id);
  end if;
  if p_venue ->> 'source' <> 'google_places' or venue_id = '' or app_venue_id = '' or venue_name = '' then
    raise exception 'Live venue payload is invalid';
  end if;
  begin
    venue_latitude := (p_venue ->> 'latitude')::double precision;
    venue_longitude := (p_venue ->> 'longitude')::double precision;
  exception when others then
    raise exception 'Live venue coordinates are invalid';
  end;
  if venue_latitude not between 1.1 and 1.6 or venue_longitude not between 103.5 and 104.2 then
    raise exception 'Live venue is outside the supported area';
  end if;

  delete from public.venues where plan_id = found_plan_id;
  insert into public.venues (plan_id, provider, provider_place_id, name, area, latitude, longitude, opening_hours, source_timestamp)
  values (
    found_plan_id,
    'google_places',
    venue_id,
    left(venue_name, 160),
    left(coalesce(p_venue ->> 'address', p_venue ->> 'area', 'Singapore'), 300),
    venue_latitude,
    venue_longitude,
    jsonb_build_object(
      'detail', left(coalesce(p_venue ->> 'detail', 'Live place result'), 240),
      'openUntil', left(coalesce(p_venue ->> 'openUntil', 'hours unavailable'), 80),
      'isOpenNow', p_venue -> 'isOpenNow',
      'tags', coalesce(p_venue -> 'tags', '[]'::jsonb)
    ),
    coalesce((p_venue ->> 'sourceTimestamp')::timestamptz, now())
  );
  update public.plans set chosen_venue_id = app_venue_id where id = found_plan_id;
  return public.plan_payload(found_plan_id);
end;
$$;

revoke execute on function public.set_plan_venue(text, text, jsonb) from public;
grant execute on function public.set_plan_venue(text, text, jsonb) to anon, authenticated;
-- END 202609140006_share_live_venues.sql

-- BEGIN 202609140007_add_payment_settlements.sql
create table public.payment_settlements (
  plan_id uuid not null references public.plans(id) on delete cascade,
  participant_id text not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'sent', 'received')),
  amount_cents integer not null check (amount_cents >= 0),
  updated_at timestamptz not null default now(),
  primary key (plan_id, participant_id),
  foreign key (plan_id, participant_id) references public.participants(plan_id, id) on delete cascade
);

alter table public.payment_settlements enable row level security;
revoke all on public.payment_settlements from anon, authenticated;

create or replace function public.bill_payload(p_plan_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'exists', true,
    'service_percent', bill.service_percent,
    'gst_percent', bill.gst_percent,
    'status', bill.status,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.client_id,
          'name', item.name,
          'price_cents', item.price_cents,
          'claimant_ids', coalesce((select jsonb_agg(claim.participant_id order by claim.created_at) from public.claims claim where claim.bill_item_id = item.id), '[]'::jsonb)
        ) order by item.position, item.created_at
      ) from public.bill_items item where item.bill_id = bill.id
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'participant_id', settlement.participant_id,
        'status', settlement.status,
        'amount_cents', settlement.amount_cents,
        'updated_at', settlement.updated_at
      ) order by settlement.updated_at)
      from public.payment_settlements settlement where settlement.plan_id = p_plan_id
    ), '[]'::jsonb)
  )
  from public.bills bill
  where bill.plan_id = p_plan_id
  order by bill.created_at desc
  limit 1;
$$;

create or replace function public.set_guest_payment_sent(p_code text, p_guest_token text, p_amount_cents integer, p_sent boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare found_plan_id uuid; found_participant_id text;
begin
  if p_amount_cents < 0 then raise exception 'Payment amount is invalid'; end if;
  select plan.id, participant.id into found_plan_id, found_participant_id
  from public.plans plan join public.participants participant on participant.plan_id = plan.id
  where plan.code = upper(trim(p_code)) and plan.expires_at > now() and plan.status <> 'closed'
    and participant.guest_token_hash = encode(extensions.digest(p_guest_token, 'sha256'), 'hex');
  if found_participant_id is null then raise exception 'Guest capability is invalid for this plan'; end if;
  if not exists (select 1 from public.bills where plan_id = found_plan_id) then raise exception 'The shared bill is unavailable'; end if;
  insert into public.payment_settlements (plan_id, participant_id, status, amount_cents)
  values (found_plan_id, found_participant_id, case when p_sent then 'sent' else 'unpaid' end, p_amount_cents)
  on conflict (plan_id, participant_id) do update set status = excluded.status, amount_cents = excluded.amount_cents, updated_at = now();
  return public.bill_payload(found_plan_id);
end;
$$;

create or replace function public.set_host_payment_status(p_code text, p_host_token text, p_participant_id text, p_amount_cents integer, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare found_plan_id uuid;
begin
  if p_status not in ('unpaid', 'sent', 'received') or p_amount_cents < 0 then raise exception 'Payment status is invalid'; end if;
  select id into found_plan_id from public.plans
  where code = upper(trim(p_code)) and expires_at > now() and status <> 'closed'
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex');
  if found_plan_id is null then raise exception 'Plan not found or host capability is invalid'; end if;
  if not exists (select 1 from public.participants where plan_id = found_plan_id and id = p_participant_id) then raise exception 'Participant is not part of this plan'; end if;
  insert into public.payment_settlements (plan_id, participant_id, status, amount_cents)
  values (found_plan_id, p_participant_id, p_status, p_amount_cents)
  on conflict (plan_id, participant_id) do update set status = excluded.status, amount_cents = excluded.amount_cents, updated_at = now();
  return public.bill_payload(found_plan_id);
end;
$$;

create trigger payment_settlements_broadcast_invalidation
after insert or update or delete on public.payment_settlements
for each row execute function public.broadcast_plan_invalidation();

revoke execute on function public.set_guest_payment_sent(text, text, integer, boolean) from public;
revoke execute on function public.set_host_payment_status(text, text, text, integer, text) from public;
grant execute on function public.set_guest_payment_sent(text, text, integer, boolean) to anon, authenticated;
grant execute on function public.set_host_payment_status(text, text, text, integer, text) to anon, authenticated;
-- END 202609140007_add_payment_settlements.sql

-- BEGIN 202609150001_add_transport_preferences.sql
alter table public.participants
add column transport_mode text not null default 'either'
check (transport_mode in ('train', 'ride', 'either'));

create or replace function public.plan_payload(p_plan_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'code', plan.code,
    'chosen_venue_id', plan.chosen_venue_id,
    'chosen_venue', (
      select jsonb_build_object(
        'id', venue.provider_place_id, 'name', venue.name, 'address', venue.area,
        'latitude', venue.latitude, 'longitude', venue.longitude,
        'detail', venue.opening_hours ->> 'detail', 'openUntil', venue.opening_hours ->> 'openUntil',
        'isOpenNow', venue.opening_hours -> 'isOpenNow', 'tags', coalesce(venue.opening_hours -> 'tags', '[]'::jsonb)
      ) from public.venues venue
      where venue.plan_id = plan.id and venue.provider = 'google_places'
      order by venue.created_at desc limit 1
    ),
    'chosen_venue_source_timestamp', (
      select venue.source_timestamp from public.venues venue
      where venue.plan_id = plan.id and venue.provider = 'google_places'
      order by venue.created_at desc limit 1
    ),
    'status', plan.status,
    'expires_at', plan.expires_at,
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', participant.id, 'name', participant.display_name, 'origin', participant.origin,
        'transportMode', participant.transport_mode
      ) order by participant.position, participant.created_at)
      from public.participants participant where participant.plan_id = plan.id
    ), '[]'::jsonb)
  ) from public.plans plan where plan.id = p_plan_id;
$$;

create or replace function public.set_plan_transport_modes(p_code text, p_host_token text, p_preferences jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare found_plan_id uuid;
begin
  if jsonb_typeof(p_preferences) <> 'array' or jsonb_array_length(p_preferences) > 50 then raise exception 'Transport preferences are invalid'; end if;
  if exists (select 1 from jsonb_array_elements(p_preferences) preference where preference->>'transport_mode' not in ('train', 'ride', 'either')) then raise exception 'Transport mode is invalid'; end if;
  select id into found_plan_id from public.plans
  where code = upper(trim(p_code)) and expires_at > now() and status <> 'closed'
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex');
  if found_plan_id is null then raise exception 'Plan not found or host capability is invalid'; end if;
  update public.participants participant set transport_mode = preference.transport_mode
  from jsonb_to_recordset(p_preferences) as preference(id text, transport_mode text)
  where participant.plan_id = found_plan_id and participant.id = preference.id;
  return public.plan_payload(found_plan_id);
end;
$$;

create or replace function public.set_guest_transport_mode(p_code text, p_guest_token text, p_transport_mode text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare found_plan_id uuid; found_participant_id text;
begin
  if p_transport_mode not in ('train', 'ride', 'either') then raise exception 'Transport mode is invalid'; end if;
  select plan.id, participant.id into found_plan_id, found_participant_id
  from public.plans plan join public.participants participant on participant.plan_id = plan.id
  where plan.code = upper(trim(p_code)) and plan.expires_at > now() and plan.status <> 'closed'
    and participant.guest_token_hash = encode(extensions.digest(p_guest_token, 'sha256'), 'hex');
  if found_participant_id is null then raise exception 'Guest capability is invalid for this plan'; end if;
  update public.participants set transport_mode = p_transport_mode where plan_id = found_plan_id and id = found_participant_id;
  return public.plan_payload(found_plan_id);
end;
$$;

revoke execute on function public.set_plan_transport_modes(text, text, jsonb) from public;
revoke execute on function public.set_guest_transport_mode(text, text, text) from public;
grant execute on function public.set_plan_transport_modes(text, text, jsonb) to anon, authenticated;
grant execute on function public.set_guest_transport_mode(text, text, text) to anon, authenticated;
-- END 202609150001_add_transport_preferences.sql

-- BEGIN 202609150002_real_outing.sql
alter table public.plans add column meetup_at timestamptz;
alter table public.plans add column commute_at timestamptz;
alter table public.plans add column venue_snapshot jsonb;
alter table public.plans add column revision bigint not null default 0;
alter table public.plans add column bill_revision bigint not null default 0;
alter table public.participants add column location jsonb;

alter function public.plan_payload(uuid) rename to legacy_plan_payload;
create function public.plan_payload(p_plan_id uuid) returns jsonb language sql security definer set search_path = '' stable as $$
  select public.legacy_plan_payload(p_plan_id) || jsonb_build_object(
    'chosen_venue', coalesce(plan.venue_snapshot, public.legacy_plan_payload(p_plan_id)->'chosen_venue'),
    'meetup_at', plan.meetup_at, 'commute_at', plan.commute_at, 'revision', plan.revision,
    'participants', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'origin', p.origin, 'location', p.location, 'transportMode', p.transport_mode) order by p.position, p.created_at) from public.participants p where p.plan_id = plan.id), '[]'::jsonb)
  ) from public.plans plan where plan.id = p_plan_id;
$$;
revoke all on function public.legacy_plan_payload(uuid) from public, anon, authenticated;
revoke all on function public.plan_payload(uuid) from public, anon, authenticated;

create function public.valid_outing_location(p_location jsonb) returns boolean language sql immutable set search_path = '' as $$
 select coalesce(jsonb_typeof(p_location) = 'object' and jsonb_typeof(p_location->'label') = 'string'
   and length(p_location->>'label') between 1 and 300
   and jsonb_typeof(p_location->'latitude') = 'number' and jsonb_typeof(p_location->'longitude') = 'number'
   and (p_location->>'latitude')::numeric between 1.1 and 1.6 and (p_location->>'longitude')::numeric between 103.5 and 104.2, false);
$$;

create function public.bump_outing_revision() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 update public.plans set revision = revision + 1 where id = case when tg_op = 'DELETE' then old.plan_id else new.plan_id end;
 return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger participants_revision before insert or update or delete on public.participants for each row execute function public.bump_outing_revision();

create function public.save_outing(p_code text, p_host_token text, p_participants jsonb, p_venue jsonb, p_meetup_at timestamptz, p_commute_at timestamptz, p_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; current_revision bigint;
begin
 if p_code is null or upper(trim(p_code)) !~ '^[A-HJ-NP-Z2-9]{6}$' or p_host_token is null or length(p_host_token) < 32 then raise exception 'Invalid plan capability'; end if;
 if p_participants is null or jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) not between 1 and 12 then raise exception 'Add between 1 and 12 participants'; end if;
 if exists (select 1 from jsonb_array_elements(p_participants) p where coalesce(length(trim(p->>'id')),0) not between 1 and 120 or coalesce(length(trim(p->>'name')),0) not between 1 and 80 or coalesce(length(trim(p->>'origin')),0) not between 1 and 120 or not public.valid_outing_location(p->'location') or coalesce(p->>'transportMode','either') not in ('train','ride','either')) then raise exception 'Every participant needs a name and a confirmed location'; end if;
 if p_venue is not null and (coalesce(p_venue->>'source','') not in ('verified','onemap') or coalesce(length(p_venue->>'name'),0) not between 1 and 160 or not public.valid_outing_location(jsonb_build_object('label',p_venue->>'name','latitude',p_venue->'latitude','longitude',p_venue->'longitude'))) then raise exception 'Choose a real venue'; end if;
 select id, revision into pid, current_revision from public.plans where code = upper(trim(p_code)) for update;
 if pid is null then
   if p_revision is not null then raise exception 'Plan expired or was removed'; end if;
   insert into public.plans(code,host_token_hash) values(upper(trim(p_code)),encode(extensions.digest(p_host_token,'sha256'),'hex')) returning id into pid;
 else
   if not exists(select 1 from public.plans where id=pid and host_token_hash=encode(extensions.digest(p_host_token,'sha256'),'hex') and status='planning' and expires_at>now()) then raise exception 'Plan is closed, expired, or host access is invalid'; end if;
   if p_revision is distinct from current_revision then raise exception 'Plan changed on another device. Refresh before saving; your local edits are retained.'; end if;
 end if;
 delete from public.participants where plan_id=pid and id not in(select p->>'id' from jsonb_array_elements(p_participants) p);
 insert into public.participants(plan_id,id,display_name,origin,position,location,transport_mode)
 select pid,p->>'id',trim(p->>'name'),trim(p->>'origin'),ordinality::integer,p->'location',coalesce(p->>'transportMode','either') from jsonb_array_elements(p_participants) with ordinality as entries(p,ordinality)
 on conflict(plan_id,id) do update set display_name=excluded.display_name, origin=excluded.origin, position=excluded.position, location=excluded.location, transport_mode=excluded.transport_mode;
 update public.plans set venue_snapshot=p_venue,chosen_venue_id=p_venue->>'id',meetup_at=p_meetup_at,commute_at=p_commute_at,revision=revision+1 where id=pid;
 return public.plan_payload(pid);
end;
$$;

create function public.save_guest_outing(p_code text,p_guest_token text,p_name text,p_location jsonb,p_mode text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare payload jsonb; pid uuid; person_id text;
begin
 if not public.valid_outing_location(p_location) or p_mode is null or p_mode not in ('train','ride','either') then raise exception 'Choose a location and travel mode'; end if;
 select id into pid from public.plans where code=upper(trim(p_code)) and status='planning' and expires_at>now() for update;
 if pid is null then raise exception 'Plan closed or unavailable'; end if;
 if (select count(*) from public.participants where plan_id=pid) >= 12 and not exists(select 1 from public.participants where plan_id=pid and guest_token_hash=encode(extensions.digest(p_guest_token,'sha256'),'hex')) then raise exception 'This plan already has 12 people'; end if;
 payload := public.upsert_guest_participant(p_code,p_guest_token,p_name,left(p_location->>'label',120));
 person_id := payload->>'participant_id';
 update public.participants set location=p_location,transport_mode=p_mode where plan_id=pid and id=person_id;
 return public.plan_payload(pid) || jsonb_build_object('participant_id',person_id);
end;
$$;
revoke all on function public.save_outing(text,text,jsonb,jsonb,timestamptz,timestamptz,bigint) from public;
revoke all on function public.save_guest_outing(text,text,text,jsonb,text) from public;
grant execute on function public.save_outing(text,text,jsonb,jsonb,timestamptz,timestamptz,bigint) to anon,authenticated;
grant execute on function public.save_guest_outing(text,text,text,jsonb,text) to anon,authenticated;
revoke all on function public.bump_outing_revision() from public,anon,authenticated;

-- Block older clients from bypassing version checks during host edits.
revoke execute on function public.update_plan(text,text,jsonb,text) from anon,authenticated;
revoke execute on function public.set_plan_venue(text,text,jsonb) from anon,authenticated;
revoke execute on function public.set_plan_transport_modes(text,text,jsonb) from anon,authenticated;

alter function public.bill_payload(uuid) rename to legacy_bill_payload;
create function public.bill_payload(p_plan_id uuid) returns jsonb language sql security definer set search_path = '' stable as $$
 select public.legacy_bill_payload(p_plan_id) || jsonb_build_object('revision',bill_revision) from public.plans where id=p_plan_id;
$$;
revoke all on function public.legacy_bill_payload(uuid) from public,anon,authenticated;
revoke all on function public.bill_payload(uuid) from public,anon,authenticated;
create function public.bump_bill_revision() returns trigger language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
 if tg_table_name='bill_items' then
   select plan_id into pid from public.bills where id=case when tg_op='DELETE' then old.bill_id else new.bill_id end;
 else pid := case when tg_op='DELETE' then old.plan_id else new.plan_id end;
 end if;
 update public.plans set bill_revision=bill_revision+1 where id=pid;
 return case when tg_op='DELETE' then old else new end;
end;
$$;
create trigger bill_items_revision before insert or update or delete on public.bill_items for each row execute function public.bump_bill_revision();
create trigger claims_revision before insert or update or delete on public.claims for each row execute function public.bump_bill_revision();
create trigger bills_revision before insert or update or delete on public.bills for each row execute function public.bump_bill_revision();
create trigger settlements_revision before insert or update or delete on public.payment_settlements for each row execute function public.bump_bill_revision();
create function public.save_bill_checked(p_code text,p_host_token text,p_service_percent numeric,p_gst_percent numeric,p_items jsonb,p_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; current_revision bigint;
begin
 select id,bill_revision into pid,current_revision from public.plans where code=upper(trim(p_code)) and host_token_hash=encode(extensions.digest(p_host_token,'sha256'),'hex') and status='planning' and expires_at>now() for update;
 if p_service_percent is null or p_gst_percent is null or p_service_percent not between 0 and 100 or p_gst_percent not between 0 and 100 then raise exception 'Invalid service or tax rate'; end if;
 if pid is null then raise exception 'Host access invalid or plan closed'; end if;
 if p_revision is distinct from current_revision then raise exception 'Bill changed on another device. Refresh before saving; your local edits are retained.'; end if;
 return public.save_bill(p_code,p_host_token,p_service_percent,p_gst_percent,p_items);
end;
$$;
revoke all on function public.bump_bill_revision() from public,anon,authenticated;
revoke execute on function public.save_bill(text,text,numeric,numeric,jsonb) from anon,authenticated;
revoke all on function public.save_bill_checked(text,text,numeric,numeric,jsonb,bigint) from public;
grant execute on function public.save_bill_checked(text,text,numeric,numeric,jsonb,bigint) to anon,authenticated;

create table public.travel_quota(bucket text primary key, window_start timestamptz not null, requests integer not null);
alter table public.travel_quota enable row level security;
create function public.consume_travel_quota(p_bucket text) returns boolean language plpgsql security definer set search_path = '' as $$
declare per_client integer; global_requests integer;
begin
 delete from public.travel_quota where window_start < now()-interval '1 day';
 insert into public.travel_quota values('global',now(),1) on conflict(bucket) do update set requests=case when travel_quota.window_start < now()-interval '1 minute' then 1 else travel_quota.requests+1 end,window_start=case when travel_quota.window_start < now()-interval '1 minute' then now() else travel_quota.window_start end returning requests into global_requests;
 insert into public.travel_quota values(p_bucket,now(),1) on conflict(bucket) do update set requests=case when travel_quota.window_start < now()-interval '1 minute' then 1 else travel_quota.requests+1 end,window_start=case when travel_quota.window_start < now()-interval '1 minute' then now() else travel_quota.window_start end returning requests into per_client;
 return per_client<=30 and global_requests<=120;
end;
$$;
revoke all on function public.consume_travel_quota(text) from public,anon,authenticated;
grant execute on function public.consume_travel_quota(text) to service_role;
-- END 202609150002_real_outing.sql

-- BEGIN 202609150003_close_legacy_write_paths.sql
-- Existing plans/capabilities remain valid. New writes must use the validated
-- outing RPCs; save_guest_outing still invokes its legacy helper as the owner.
revoke execute on function public.create_plan(text,text,jsonb,text) from public,anon,authenticated;
revoke execute on function public.upsert_guest_participant(text,text,text,text) from public,anon,authenticated;

-- Quota rows are server-only; make that explicit in addition to default-deny RLS.
revoke all on public.travel_quota from public,anon,authenticated;
-- END 202609150003_close_legacy_write_paths.sql

-- BEGIN 202609150004_weighted_travel_budget.sql
-- Reserve worst-case external work, including one token refresh/retry, before
-- issuing provider calls. Counters are shared across all Edge instances.
create function public.consume_travel_budget(p_bucket text, p_units integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare per_client integer; global_requests integer;
begin
 if p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$' or p_units is null or p_units < 1 or p_units > 14 then return false; end if;
 delete from public.travel_quota where window_start < now()-interval '1 day';
 insert into public.travel_quota values('provider-budget',now(),p_units)
 on conflict(bucket) do update set requests=case when travel_quota.window_start < now()-interval '1 minute' then p_units else travel_quota.requests+p_units end,
 window_start=case when travel_quota.window_start < now()-interval '1 minute' then now() else travel_quota.window_start end returning requests into global_requests;
 insert into public.travel_quota values('budget-' || p_bucket,now(),p_units)
 on conflict(bucket) do update set requests=case when travel_quota.window_start < now()-interval '1 minute' then p_units else travel_quota.requests+p_units end,
 window_start=case when travel_quota.window_start < now()-interval '1 minute' then now() else travel_quota.window_start end returning requests into per_client;
 return per_client<=160 and global_requests<=200;
end;
$$;
revoke all on function public.consume_travel_budget(text,integer) from public,anon,authenticated;
grant execute on function public.consume_travel_budget(text,integer) to service_role;
-- END 202609150004_weighted_travel_budget.sql

-- BEGIN 202609160001_venue_votes.sql
-- One vote per host capability or joined guest. Votes never replace the confirmed venue.
create table public.venue_votes (
 plan_id uuid not null references public.plans(id) on delete cascade,
 voter_id text not null,
 venue jsonb not null,
 primary key(plan_id,voter_id)
);
alter table public.venue_votes enable row level security;
revoke all on public.venue_votes from public,anon,authenticated;

create function public.get_venue_votes(p_code text) returns jsonb
language sql security definer set search_path = '' stable as $$
 select coalesce(jsonb_agg(jsonb_build_object('voterId',v.voter_id,'venue',v.venue) order by v.voter_id),'[]'::jsonb)
 from public.venue_votes v join public.plans p on p.id=v.plan_id
 where p.code=upper(trim(p_code)) and p.expires_at>now()
 and (v.voter_id='host' or exists(select 1 from public.participants person where person.plan_id=p.id and 'guest:'||person.id=v.voter_id));
$$;

create function public.set_venue_vote(p_code text,p_token text,p_venue jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pid uuid; voter text; host_hash text;
begin
 if p_token is null or length(p_token)<32 then raise exception 'Save your entry before voting'; end if;
 select id,host_token_hash into pid,host_hash from public.plans where code=upper(trim(p_code)) and status='planning' and expires_at>now() for update;
 if pid is null then raise exception 'Plan is closed or unavailable'; end if;
 if host_hash=encode(extensions.digest(p_token,'sha256'),'hex') then voter:='host';
 else select 'guest:'||id into voter from public.participants where plan_id=pid and guest_token_hash=encode(extensions.digest(p_token,'sha256'),'hex'); end if;
 if voter is null then raise exception 'Save your entry before voting'; end if;
 if p_venue is null then delete from public.venue_votes where plan_id=pid and voter_id=voter;
 else
  if octet_length(p_venue::text)>8192 or coalesce(length(p_venue->>'id'),0) not between 1 and 160 or coalesce(p_venue->>'source','') not in ('verified','onemap') or coalesce(length(p_venue->>'name'),0) not between 1 and 160 or not public.valid_outing_location(jsonb_build_object('label',p_venue->>'name','latitude',p_venue->'latitude','longitude',p_venue->'longitude')) then raise exception 'Choose a real venue'; end if;
  insert into public.venue_votes(plan_id,voter_id,venue) values(pid,voter,p_venue) on conflict(plan_id,voter_id) do update set venue=excluded.venue;
 end if;
 return public.get_venue_votes(p_code);
end;
$$;
revoke all on function public.get_venue_votes(text) from public;
revoke all on function public.set_venue_vote(text,text,jsonb) from public;
grant execute on function public.get_venue_votes(text) to anon,authenticated;
grant execute on function public.set_venue_vote(text,text,jsonb) to anon,authenticated;
-- END 202609160001_venue_votes.sql

-- BEGIN 202609160002_places_budget.sql
-- Places content is deliberately not stored here. Only request counters.
create table public.places_request_budget (
  bucket text primary key,
  window_start timestamptz not null,
  requests integer not null check (requests >= 0)
);
alter table public.places_request_budget enable row level security;
revoke all on public.places_request_budget from public, anon, authenticated;

create function public.consume_places_budget(p_bucket text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare month_start timestamptz; used integer; client_used integer;
begin
  if p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$' then return false; end if;
  -- Google billing months use Pacific time. Reserve before every attempt; no retries.
  month_start := date_trunc('month', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  insert into public.places_request_budget values ('nearby-enterprise', month_start, 0)
    on conflict (bucket) do nothing;
  select requests into used from public.places_request_budget where bucket='nearby-enterprise' for update;
  update public.places_request_budget set requests=0, window_start=month_start
    where bucket='nearby-enterprise' and window_start < month_start;
  select requests into used from public.places_request_budget where bucket='nearby-enterprise';
  if used >= 900 then return false; end if;
  delete from public.places_request_budget where bucket <> 'nearby-enterprise' and window_start < now()-interval '1 day';
  insert into public.places_request_budget values (p_bucket, now(), 0) on conflict (bucket) do nothing;
  update public.places_request_budget set requests=0, window_start=now()
    where bucket=p_bucket and window_start < now()-interval '1 hour';
  select requests into client_used from public.places_request_budget where bucket=p_bucket;
  if client_used >= 10 then return false; end if;
  update public.places_request_budget set requests=requests+1 where bucket in ('nearby-enterprise',p_bucket);
  return true;
end;
$$;
revoke all on function public.consume_places_budget(text) from public, anon, authenticated;
grant execute on function public.consume_places_budget(text) to service_role;
-- END 202609160002_places_budget.sql

-- BEGIN 202609160003_google_venue_references.sql
-- Google content never belongs in saved plan/vote JSON.
create function public.normalize_outing_venue(p_venue jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
begin
 if p_venue is null then return null; end if;
 if p_venue->>'source'='google_places' then
   if coalesce(p_venue->>'providerPlaceId','') !~ '^[A-Za-z0-9_-]{1,150}$' then raise exception 'Choose a valid Google restaurant'; end if;
   return jsonb_build_object('source','google_places','providerPlaceId',p_venue->>'providerPlaceId');
 end if;
 if octet_length(p_venue::text)>8192 or coalesce(length(p_venue->>'id'),0) not between 1 and 160 or coalesce(p_venue->>'source','') not in ('verified','onemap') or coalesce(length(p_venue->>'name'),0) not between 1 and 160 or not public.valid_outing_location(jsonb_build_object('label',p_venue->>'name','latitude',p_venue->'latitude','longitude',p_venue->'longitude')) then raise exception 'Choose a real venue'; end if;
 return p_venue;
end;
$$;
revoke all on function public.normalize_outing_venue(jsonb) from public,anon,authenticated;

create or replace function public.save_outing(p_code text, p_host_token text, p_participants jsonb, p_venue jsonb, p_meetup_at timestamptz, p_commute_at timestamptz, p_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; current_revision bigint;
begin
 if p_code is null or upper(trim(p_code)) !~ '^[A-HJ-NP-Z2-9]{6}$' or p_host_token is null or length(p_host_token) < 32 then raise exception 'Invalid plan capability'; end if;
 if p_participants is null or jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) not between 1 and 12 then raise exception 'Add between 1 and 12 participants'; end if;
 if exists (select 1 from jsonb_array_elements(p_participants) p where coalesce(length(trim(p->>'id')),0) not between 1 and 120 or coalesce(length(trim(p->>'name')),0) not between 1 and 80 or coalesce(length(trim(p->>'origin')),0) not between 1 and 120 or not public.valid_outing_location(p->'location') or coalesce(p->>'transportMode','either') not in ('train','ride','either')) then raise exception 'Every participant needs a name and a confirmed location'; end if;
 p_venue := public.normalize_outing_venue(p_venue);
 select id, revision into pid, current_revision from public.plans where code = upper(trim(p_code)) for update;
 if pid is null then
   if p_revision is not null then raise exception 'Plan expired or was removed'; end if;
   insert into public.plans(code,host_token_hash) values(upper(trim(p_code)),encode(extensions.digest(p_host_token,'sha256'),'hex')) returning id into pid;
 else
   if not exists(select 1 from public.plans where id=pid and host_token_hash=encode(extensions.digest(p_host_token,'sha256'),'hex') and status='planning' and expires_at>now()) then raise exception 'Plan is closed, expired, or host access is invalid'; end if;
   if p_revision is distinct from current_revision then raise exception 'Plan changed on another device. Refresh before saving; your local edits are retained.'; end if;
 end if;
 delete from public.participants where plan_id=pid and id not in(select p->>'id' from jsonb_array_elements(p_participants) p);
 insert into public.participants(plan_id,id,display_name,origin,position,location,transport_mode)
 select pid,p->>'id',trim(p->>'name'),trim(p->>'origin'),ordinality::integer,p->'location',coalesce(p->>'transportMode','either') from jsonb_array_elements(p_participants) with ordinality as entries(p,ordinality)
 on conflict(plan_id,id) do update set display_name=excluded.display_name, origin=excluded.origin, position=excluded.position, location=excluded.location, transport_mode=excluded.transport_mode;
 update public.plans set venue_snapshot=p_venue,chosen_venue_id=case when p_venue->>'source'='google_places' then 'google-'||(p_venue->>'providerPlaceId') else p_venue->>'id' end,meetup_at=p_meetup_at,commute_at=p_commute_at,revision=revision+1 where id=pid;
 return public.plan_payload(pid);
end;
$$;

create or replace function public.set_venue_vote(p_code text,p_token text,p_venue jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare pid uuid; voter text; host_hash text;
begin
 if p_token is null or length(p_token)<32 then raise exception 'Save your entry before voting'; end if;
 select id,host_token_hash into pid,host_hash from public.plans where code=upper(trim(p_code)) and status='planning' and expires_at>now() for update;
 if pid is null then raise exception 'Plan is closed or unavailable'; end if;
 if host_hash=encode(extensions.digest(p_token,'sha256'),'hex') then voter:='host';
 else select 'guest:'||id into voter from public.participants where plan_id=pid and guest_token_hash=encode(extensions.digest(p_token,'sha256'),'hex'); end if;
 if voter is null then raise exception 'Save your entry before voting'; end if;
 if p_venue is null then delete from public.venue_votes where plan_id=pid and voter_id=voter;
 else
  p_venue := public.normalize_outing_venue(p_venue);
  insert into public.venue_votes(plan_id,voter_id,venue) values(pid,voter,p_venue) on conflict(plan_id,voter_id) do update set venue=excluded.venue;
 end if;
 return public.get_venue_votes(p_code);
end;
$$;

-- Preserve legacy selected IDs before removing the old provider display content.
update public.plans p set venue_snapshot=jsonb_build_object('source','google_places','providerPlaceId',v.provider_place_id),
chosen_venue_id='google-'||v.provider_place_id
from (select distinct on(plan_id) plan_id,provider_place_id from public.venues where provider='google_places' order by plan_id,created_at desc) v
where p.id=v.plan_id and p.venue_snapshot is null;

update public.plans set venue_snapshot=jsonb_build_object('source','google_places','providerPlaceId',coalesce(venue_snapshot->>'providerPlaceId',regexp_replace(venue_snapshot->>'id','^google-','')))
where venue_snapshot->>'source'='google_places';
update public.venue_votes set venue=jsonb_build_object('source','google_places','providerPlaceId',coalesce(venue->>'providerPlaceId',regexp_replace(venue->>'id','^google-','')))
where venue->>'source'='google_places';
delete from public.venues where provider='google_places';
-- END 202609160003_google_venue_references.sql

-- BEGIN 202609160004_places_details_budget.sql
create function public.consume_places_budget(p_bucket text, p_sku text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare month_start timestamptz; used integer; client_used integer;
begin
  if p_sku is null or p_sku not in ('nearby-enterprise','details-enterprise') then return false; end if;
  if p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$' then return false; end if;
  -- Google billing months use Pacific time. Reserve before every attempt; no retries.
  month_start := date_trunc('month', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  insert into public.places_request_budget values (p_sku, month_start, 0)
    on conflict (bucket) do nothing;
  select requests into used from public.places_request_budget where bucket=p_sku for update;
  update public.places_request_budget set requests=0, window_start=month_start
    where bucket=p_sku and window_start < month_start;
  select requests into used from public.places_request_budget where bucket=p_sku;
  if used >= 900 then return false; end if;
  delete from public.places_request_budget where bucket not in ('nearby-enterprise','details-enterprise') and window_start < now()-interval '1 day';
  insert into public.places_request_budget values (p_sku||':'||p_bucket, now(), 0) on conflict (bucket) do nothing;
  update public.places_request_budget set requests=0, window_start=now()
    where bucket=p_sku||':'||p_bucket and window_start < now()-interval '1 hour';
  select requests into client_used from public.places_request_budget where bucket=p_sku||':'||p_bucket;
  if client_used >= (case when p_sku='details-enterprise' then 60 else 10 end) then return false; end if;
  update public.places_request_budget set requests=requests+1 where bucket in (p_sku,p_sku||':'||p_bucket);
  return true;
end;
$$;
revoke all on function public.consume_places_budget(text,text) from public, anon, authenticated;
grant execute on function public.consume_places_budget(text,text) to service_role;

-- Preserve the old Edge version's interface without its legacy cleanup deleting
-- the new details counter. Both versions share the same monthly search bucket.
create or replace function public.consume_places_budget(p_bucket text)
returns boolean language sql security definer set search_path='' as $$
 select public.consume_places_budget(p_bucket,'nearby-enterprise');
$$;
-- END 202609160004_places_details_budget.sql

-- BEGIN 202609160005_restaurant_swipes.sql
create table public.swipe_decks(plan_id uuid primary key references public.plans(id) on delete cascade, venues jsonb not null);
create table public.venue_swipes(plan_id uuid references public.plans(id) on delete cascade, voter_id text not null, venue_id text not null, choice text not null check(choice in ('like','pass','neutral')), primary key(plan_id,voter_id,venue_id));
alter table public.swipe_decks enable row level security;
alter table public.venue_swipes enable row level security;
revoke all on public.swipe_decks,public.venue_swipes from public,anon,authenticated;
create function public.swipe_venue_key(v jsonb) returns text language sql immutable set search_path='' as $$
 select case when v->>'source'='google_places' then 'google-'||(v->>'providerPlaceId') else v->>'id' end;
$$;
-- Existing single votes become likes; never reinterpret an absent vote as neutral.
insert into public.venue_swipes select plan_id,voter_id,public.swipe_venue_key(venue),'like' from public.venue_votes;

create function public.get_swipe_state(p_code text) returns jsonb language sql security definer set search_path='' stable as $$
 select jsonb_build_object('venues',coalesce((select venues from public.swipe_decks where plan_id=p.id),'[]'::jsonb),
 'voters',jsonb_build_array('host')||coalesce((select jsonb_agg('guest:'||id order by id) from public.participants where plan_id=p.id and guest_token_hash is not null),'[]'::jsonb),
 'swipes',coalesce((select jsonb_agg(jsonb_build_object('voterId',s.voter_id,'venueId',s.venue_id,'choice',s.choice)) from public.venue_swipes s where s.plan_id=p.id and (s.voter_id='host' or exists(select 1 from public.participants where plan_id=p.id and 'guest:'||id=s.voter_id and guest_token_hash is not null))),'[]'::jsonb))
 from public.plans p where p.code=upper(trim(p_code)) and p.expires_at>now();
$$;

create function public.start_swipe_deck(p_code text,p_token text,p_venues jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid; clean jsonb; v jsonb;
begin
 select id into pid from public.plans where code=upper(trim(p_code)) and status='planning' and expires_at>now() and length(p_token)>=32 and host_token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if pid is null then raise exception 'Only the host of an open plan can share the shortlist'; end if;
 if exists(select 1 from public.swipe_decks where plan_id=pid) then return public.get_swipe_state(p_code); end if;
 if p_venues is null or jsonb_typeof(p_venues)<>'array' or jsonb_array_length(p_venues) not between 1 and 20 then raise exception 'Choose 1 to 20 restaurants'; end if;
 clean:='[]'::jsonb;
 for v in select value from jsonb_array_elements(p_venues) loop
  v:=public.normalize_outing_venue(v);
  if v is null then raise exception 'Invalid restaurant'; end if;
  if not exists(select 1 from jsonb_array_elements(clean) x where public.swipe_venue_key(x)=public.swipe_venue_key(v)) then clean:=clean||jsonb_build_array(v); end if;
 end loop;
 -- Preserve restaurants which received a vote before the swipe upgrade.
 for v in select venue from public.venue_votes where plan_id=pid loop
  if not exists(select 1 from jsonb_array_elements(clean) x where public.swipe_venue_key(x)=public.swipe_venue_key(v)) then clean:=clean||jsonb_build_array(public.normalize_outing_venue(v)); end if;
 end loop;
 insert into public.swipe_decks values(pid,clean);
 return public.get_swipe_state(p_code);
end;
$$;

create function public.set_restaurant_swipe(p_code text,p_token text,p_venue_id text,p_choice text) returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid; voter text; host_hash text;
begin
 if p_choice is null or p_choice not in ('like','pass','neutral') then raise exception 'Invalid swipe'; end if;
 select id,host_token_hash into pid,host_hash from public.plans where code=upper(trim(p_code)) and status='planning' and expires_at>now() for update;
 if pid is null then raise exception 'Plan closed or unavailable'; end if;
 if p_token is null or length(p_token)<32 then raise exception 'Save your entry before swiping'; end if;
 if host_hash=encode(extensions.digest(p_token,'sha256'),'hex') then voter:='host';
 else select 'guest:'||id into voter from public.participants where plan_id=pid and guest_token_hash=encode(extensions.digest(p_token,'sha256'),'hex'); end if;
 if voter is null then raise exception 'Save your entry before swiping'; end if;
 if not exists(select 1 from public.swipe_decks d,jsonb_array_elements(d.venues) v where d.plan_id=pid and public.swipe_venue_key(v)=p_venue_id) then raise exception 'Restaurant is not in the shared shortlist'; end if;
 insert into public.venue_swipes values(pid,voter,p_venue_id,p_choice) on conflict(plan_id,voter_id,venue_id) do update set choice=excluded.choice;
 return public.get_swipe_state(p_code);
end;
$$;
revoke all on function public.swipe_venue_key(jsonb) from public,anon,authenticated;
revoke all on function public.get_swipe_state(text),public.start_swipe_deck(text,text,jsonb),public.set_restaurant_swipe(text,text,text,text) from public;
grant execute on function public.get_swipe_state(text),public.start_swipe_deck(text,text,jsonb),public.set_restaurant_swipe(text,text,text,text) to anon,authenticated;
-- END 202609160005_restaurant_swipes.sql

-- BEGIN 202609160006_places_media_budget.sql
create or replace function public.consume_places_budget(p_bucket text, p_sku text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare month_start timestamptz; used integer; client_used integer;
begin
  if p_sku is null or p_sku not in ('nearby-enterprise','details-enterprise','photos','reviews') then return false; end if;
  if p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$' then return false; end if;
  -- Google billing months use Pacific time. Reserve before every attempt; no retries.
  month_start := date_trunc('month', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  insert into public.places_request_budget values (p_sku, month_start, 0)
    on conflict (bucket) do nothing;
  select requests into used from public.places_request_budget where bucket=p_sku for update;
  update public.places_request_budget set requests=0, window_start=month_start
    where bucket=p_sku and window_start < month_start;
  select requests into used from public.places_request_budget where bucket=p_sku;
  if used >= 900 then return false; end if;
  delete from public.places_request_budget where bucket not in ('nearby-enterprise','details-enterprise','photos','reviews') and window_start < now()-interval '1 day';
  insert into public.places_request_budget values (p_sku||':'||p_bucket, now(), 0) on conflict (bucket) do nothing;
  update public.places_request_budget set requests=0, window_start=now()
    where bucket=p_sku||':'||p_bucket and window_start < now()-interval '1 hour';
  select requests into client_used from public.places_request_budget where bucket=p_sku||':'||p_bucket;
  if client_used >= (case when p_sku in ('details-enterprise','photos') then 60 when p_sku='reviews' then 30 else 10 end) then return false; end if;
  update public.places_request_budget set requests=requests+1 where bucket in (p_sku,p_sku||':'||p_bucket);
  return true;
end;
$$;
revoke all on function public.consume_places_budget(text,text) from public, anon, authenticated;
grant execute on function public.consume_places_budget(text,text) to service_role;
-- END 202609160006_places_media_budget.sql

-- BEGIN 202609160007_swipe_local_progress.sql
-- Atomically preserve the host's device-only ratings when publishing a deck.
-- Existing shared ratings take precedence over older local records.
create function public.start_swipe_deck_with_progress(p_code text,p_token text,p_venues jsonb,p_swipes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb; item jsonb; pid uuid;
begin
 if p_swipes is null or jsonb_typeof(p_swipes)<>'array' or jsonb_array_length(p_swipes)>50 then raise exception 'Invalid local progress'; end if;
 payload:=public.start_swipe_deck(p_code,p_token,p_venues);
 select id into pid from public.plans where code=upper(trim(p_code));
 for item in select value from jsonb_array_elements(p_swipes) loop
  if not exists(select 1 from public.venue_swipes where plan_id=pid and voter_id='host' and venue_id=item->>'venueId') and exists(select 1 from jsonb_array_elements(payload->'venues') v where public.swipe_venue_key(v)=item->>'venueId') then
   perform public.set_restaurant_swipe(p_code,p_token,item->>'venueId',item->>'choice');
  end if;
 end loop;
 return public.get_swipe_state(p_code);
end;
$$;
revoke all on function public.start_swipe_deck_with_progress(text,text,jsonb,jsonb) from public;
grant execute on function public.start_swipe_deck_with_progress(text,text,jsonb,jsonb) to anon,authenticated;
-- END 202609160007_swipe_local_progress.sql

-- BEGIN 202609160008_refresh_swipe_deck.sql
create function public.refresh_swipe_deck(p_code text,p_token text,p_venues jsonb,p_expected jsonb,p_append boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid; old jsonb; clean jsonb; v jsonb;
begin
 select id into pid from public.plans where code=upper(trim(p_code)) and status='planning' and expires_at>now() and length(p_token)>=32 and host_token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if pid is null then raise exception 'Only the host of an open plan can change restaurants'; end if;
 select venues into old from public.swipe_decks where plan_id=pid;
 if coalesce(old,'[]'::jsonb) is distinct from p_expected then raise exception 'Restaurant list changed. Refresh progress and try again.'; end if;
 if p_venues is null or jsonb_typeof(p_venues)<>'array' or jsonb_array_length(p_venues) not between 1 and 20 then raise exception 'Choose 1 to 20 restaurants per search'; end if;
 clean:=case when p_append then coalesce(old,'[]'::jsonb) else '[]'::jsonb end;
 for v in select value from jsonb_array_elements(p_venues) loop
  v:=public.normalize_outing_venue(v);
  if v is null then raise exception 'Invalid restaurant'; end if;
  if not exists(select 1 from jsonb_array_elements(clean) x where public.swipe_venue_key(x)=public.swipe_venue_key(v)) then clean:=clean||jsonb_build_array(v); end if;
 end loop;
 if jsonb_array_length(clean)>60 then raise exception 'This outing has reached 60 restaurant cards. Choose a new area to replace the list.'; end if;
 insert into public.swipe_decks values(pid,clean) on conflict(plan_id) do update set venues=excluded.venues;
 -- Retain old ratings; only venues in the active deck participate in ranking.
 return public.get_swipe_state(p_code);
end;
$$;
revoke all on function public.refresh_swipe_deck(text,text,jsonb,jsonb,boolean) from public;
grant execute on function public.refresh_swipe_deck(text,text,jsonb,jsonb,boolean) to anon,authenticated;
-- END 202609160008_refresh_swipe_deck.sql

-- BEGIN 202609160009_remove_places_monthly_caps.sql
-- User requested removal of monthly enforcement. Keep monthly metering and hourly limits.
create or replace function public.consume_places_budget(p_bucket text, p_sku text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare month_start timestamptz; used integer; client_used integer;
begin
  if p_sku is null or p_sku not in ('nearby-enterprise','details-enterprise','photos','reviews') then return false; end if;
  if p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$' then return false; end if;
  -- Google billing months use Pacific time. Reserve before every attempt; no retries.
  month_start := date_trunc('month', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  insert into public.places_request_budget values (p_sku, month_start, 0)
    on conflict (bucket) do nothing;
  select requests into used from public.places_request_budget where bucket=p_sku for update;
  update public.places_request_budget set requests=0, window_start=month_start
    where bucket=p_sku and window_start < month_start;
  select requests into used from public.places_request_budget where bucket=p_sku;
  delete from public.places_request_budget where bucket not in ('nearby-enterprise','details-enterprise','photos','reviews') and window_start < now()-interval '1 day';
  insert into public.places_request_budget values (p_sku||':'||p_bucket, now(), 0) on conflict (bucket) do nothing;
  update public.places_request_budget set requests=0, window_start=now()
    where bucket=p_sku||':'||p_bucket and window_start < now()-interval '1 hour';
  select requests into client_used from public.places_request_budget where bucket=p_sku||':'||p_bucket;
  if client_used >= (case when p_sku in ('details-enterprise','photos') then 60 when p_sku='reviews' then 30 else 10 end) then return false; end if;
  update public.places_request_budget set requests=requests+1 where bucket in (p_sku,p_sku||':'||p_bucket);
  return true;
end;
$$;
revoke all on function public.consume_places_budget(text,text) from public, anon, authenticated;
grant execute on function public.consume_places_budget(text,text) to service_role;
-- END 202609160009_remove_places_monthly_caps.sql

-- BEGIN 202609160010_remove_places_hourly_caps.sql
-- User requested removal of hourly enforcement too. Retain metering, validation and permissions.
create or replace function public.consume_places_budget(p_bucket text, p_sku text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare month_start timestamptz; used integer; client_used integer;
begin
  if p_sku is null or p_sku not in ('nearby-enterprise','details-enterprise','photos','reviews') then return false; end if;
  if p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$' then return false; end if;
  -- Google billing months use Pacific time. Reserve before every attempt; no retries.
  month_start := date_trunc('month', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  insert into public.places_request_budget values (p_sku, month_start, 0)
    on conflict (bucket) do nothing;
  select requests into used from public.places_request_budget where bucket=p_sku for update;
  update public.places_request_budget set requests=0, window_start=month_start
    where bucket=p_sku and window_start < month_start;
  select requests into used from public.places_request_budget where bucket=p_sku;
  delete from public.places_request_budget where bucket not in ('nearby-enterprise','details-enterprise','photos','reviews') and window_start < now()-interval '1 day';
  insert into public.places_request_budget values (p_sku||':'||p_bucket, now(), 0) on conflict (bucket) do nothing;
  update public.places_request_budget set requests=0, window_start=now()
    where bucket=p_sku||':'||p_bucket and window_start < now()-interval '1 hour';
  select requests into client_used from public.places_request_budget where bucket=p_sku||':'||p_bucket;
  update public.places_request_budget set requests=requests+1 where bucket in (p_sku,p_sku||':'||p_bucket);
  return true;
end;
$$;
revoke all on function public.consume_places_budget(text,text) from public, anon, authenticated;
grant execute on function public.consume_places_budget(text,text) to service_role;
-- END 202609160010_remove_places_hourly_caps.sql

-- BEGIN 202609160011_restaurant_special_mentions.sql
-- Endorsements remain a single like and never confirm the meetup venue.
alter table public.venue_swipes add column special boolean not null default false;
alter table public.venue_swipes add constraint mention_requires_like check(not special or choice='like');
create or replace function public.get_swipe_state(p_code text) returns jsonb language sql security definer set search_path='' stable as $$
 select jsonb_build_object('venues',coalesce((select venues from public.swipe_decks where plan_id=p.id),'[]'::jsonb),
 'voters',jsonb_build_array('host')||coalesce((select jsonb_agg('guest:'||id order by id) from public.participants where plan_id=p.id and guest_token_hash is not null),'[]'::jsonb),
 'swipes',coalesce((select jsonb_agg(jsonb_build_object('voterId',s.voter_id,'venueId',s.venue_id,'choice',s.choice,'special',s.special)) from public.venue_swipes s where s.plan_id=p.id and (s.voter_id='host' or exists(select 1 from public.participants where plan_id=p.id and 'guest:'||id=s.voter_id and guest_token_hash is not null))),'[]'::jsonb))
 from public.plans p where p.code=upper(trim(p_code)) and p.expires_at>now();
$$;

create or replace function public.set_restaurant_swipe(p_code text,p_token text,p_venue_id text,p_choice text) returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid; voter text; host_hash text;
begin
 if p_choice is null or p_choice not in ('like','pass','neutral') then raise exception 'Invalid swipe'; end if;
 select id,host_token_hash into pid,host_hash from public.plans where code=upper(trim(p_code)) and status='planning' and expires_at>now() for update;
 if pid is null then raise exception 'Plan closed or unavailable'; end if;
 if p_token is null or length(p_token)<32 then raise exception 'Save your entry before swiping'; end if;
 if host_hash=encode(extensions.digest(p_token,'sha256'),'hex') then voter:='host';
 else select 'guest:'||id into voter from public.participants where plan_id=pid and guest_token_hash=encode(extensions.digest(p_token,'sha256'),'hex'); end if;
 if voter is null then raise exception 'Save your entry before swiping'; end if;
 if not exists(select 1 from public.swipe_decks d,jsonb_array_elements(d.venues) v where d.plan_id=pid and public.swipe_venue_key(v)=p_venue_id) then raise exception 'Restaurant is not in the shared shortlist'; end if;
 insert into public.venue_swipes(plan_id,voter_id,venue_id,choice,special) values(pid,voter,p_venue_id,p_choice,false) on conflict(plan_id,voter_id,venue_id) do update set choice=excluded.choice,special=false;
 return public.get_swipe_state(p_code);
end;
$$;
create function public.set_restaurant_mention(p_code text,p_token text,p_venue_id text,p_enabled boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid; voter text;
begin
 if p_enabled is null then raise exception 'Choose whether to mention this restaurant'; end if;
 -- Reuse the existing locked capability, open-plan and active-deck validation.
 perform public.set_restaurant_swipe(p_code,p_token,p_venue_id,'like');
 select id,case when host_token_hash=encode(extensions.digest(p_token,'sha256'),'hex') then 'host' else null end into pid,voter from public.plans where code=upper(trim(p_code));
 if voter is null then select 'guest:'||id into voter from public.participants where plan_id=pid and guest_token_hash=encode(extensions.digest(p_token,'sha256'),'hex'); end if;
 update public.venue_swipes set special=p_enabled where plan_id=pid and voter_id=voter and venue_id=p_venue_id;
 return public.get_swipe_state(p_code);
end;
$$;
revoke all on function public.set_restaurant_mention(text,text,text,boolean) from public;
grant execute on function public.set_restaurant_mention(text,text,text,boolean) to anon,authenticated;
-- Atomically preserve the host's device-only ratings when publishing a deck.
-- Existing shared ratings take precedence over older local records.
create or replace function public.start_swipe_deck_with_progress(p_code text,p_token text,p_venues jsonb,p_swipes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb; item jsonb; pid uuid;
begin
 if p_swipes is null or jsonb_typeof(p_swipes)<>'array' or jsonb_array_length(p_swipes)>50 then raise exception 'Invalid local progress'; end if;
 payload:=public.start_swipe_deck(p_code,p_token,p_venues);
 select id into pid from public.plans where code=upper(trim(p_code));
 for item in select value from jsonb_array_elements(p_swipes) loop
  if not exists(select 1 from public.venue_swipes where plan_id=pid and voter_id='host' and venue_id=item->>'venueId') and exists(select 1 from jsonb_array_elements(payload->'venues') v where public.swipe_venue_key(v)=item->>'venueId') then
   if item->>'choice'='like' and item->'special'='true'::jsonb then
    perform public.set_restaurant_mention(p_code,p_token,item->>'venueId',true);
   else
    perform public.set_restaurant_swipe(p_code,p_token,item->>'venueId',item->>'choice');
   end if;
  end if;
 end loop;
 return public.get_swipe_state(p_code);
end;
$$;
revoke all on function public.start_swipe_deck_with_progress(text,text,jsonb,jsonb) from public;
grant execute on function public.start_swipe_deck_with_progress(text,text,jsonb,jsonb) to anon,authenticated;
-- END 202609160011_restaurant_special_mentions.sql

-- BEGIN 202609180001_party_invites.sql
-- Name-first invitations. Name selection is intentionally open to holders of
-- the party code; it never grants the host capability. Tokens are excluded from
-- public plan payloads and direct table access is denied.
alter table public.participants add column party_join_token text;
create or replace function public.save_outing(p_code text, p_host_token text, p_participants jsonb, p_venue jsonb, p_meetup_at timestamptz, p_commute_at timestamptz, p_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; current_revision bigint;
begin
 if p_code is null or upper(trim(p_code)) !~ '^[A-HJ-NP-Z2-9]{6}$' or p_host_token is null or length(p_host_token) < 32 then raise exception 'Invalid plan capability'; end if;
 if p_participants is null or jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) not between 1 and 12 then raise exception 'Add between 1 and 12 participants'; end if;
 if exists (select 1 from jsonb_array_elements(p_participants) p where coalesce(length(trim(p->>'id')),0) not between 1 and 120 or coalesce(length(trim(p->>'name')),0) not between 1 and 80 or coalesce(length(trim(p->>'origin')),0) not between 1 and 120 or (p->'location' is not null and p->'location'<>'null'::jsonb and not public.valid_outing_location(p->'location')) or coalesce(p->>'transportMode','either') not in ('train','ride','either')) then raise exception 'Every participant needs a name; any provided location must be valid'; end if;
 p_venue := public.normalize_outing_venue(p_venue);
 select id, revision into pid, current_revision from public.plans where code = upper(trim(p_code)) for update;
 if pid is null then
   if p_revision is not null then raise exception 'Plan expired or was removed'; end if;
   insert into public.plans(code,host_token_hash) values(upper(trim(p_code)),encode(extensions.digest(p_host_token,'sha256'),'hex')) returning id into pid;
 else
   if not exists(select 1 from public.plans where id=pid and host_token_hash=encode(extensions.digest(p_host_token,'sha256'),'hex') and status='planning' and expires_at>now()) then raise exception 'Plan is closed, expired, or host access is invalid'; end if;
   -- Retrying an uncertain initial creation recovers the existing party rather
   -- than overwriting guests who may already have joined it.
   if p_revision is null then return public.plan_payload(pid); end if;
   if p_revision is distinct from current_revision then raise exception 'Plan changed on another device. Refresh before saving; your local edits are retained.'; end if;
 end if;
 delete from public.participants where plan_id=pid and id not in(select p->>'id' from jsonb_array_elements(p_participants) p);
 insert into public.participants(plan_id,id,display_name,origin,position,location,transport_mode)
 select pid,p->>'id',trim(p->>'name'),trim(p->>'origin'),ordinality::integer,p->'location',coalesce(p->>'transportMode','either') from jsonb_array_elements(p_participants) with ordinality as entries(p,ordinality)
 on conflict(plan_id,id) do update set display_name=excluded.display_name, origin=excluded.origin, position=excluded.position, location=excluded.location, transport_mode=excluded.transport_mode;
 update public.plans set venue_snapshot=p_venue,chosen_venue_id=case when p_venue->>'source'='google_places' then 'google-'||(p_venue->>'providerPlaceId') else p_venue->>'id' end,meetup_at=p_meetup_at,commute_at=p_commute_at,revision=revision+1 where id=pid;
 return public.plan_payload(pid);
end;
$$;

create function public.join_party(p_code text,p_name text,p_participant_id text,p_guest_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid; person public.participants%rowtype; capability text; token_hash text;
begin
 if p_code is null or upper(trim(p_code)) !~ '^[A-HJ-NP-Z2-9]{6}$' or p_guest_token is null or length(p_guest_token) not between 32 and 128 then raise exception 'Invalid party entry'; end if;
 select id into pid from public.plans where code=upper(trim(p_code)) and status='planning' and expires_at>now() for update;
 if pid is null then raise exception 'This party is closed or unavailable'; end if;
 token_hash:=encode(extensions.digest(p_guest_token,'sha256'),'hex');
 if p_participant_id is not null then
  select * into person from public.participants where plan_id=pid and id=p_participant_id;
  if person.id is null then raise exception 'That person is no longer in the party. Reopen the invite.'; end if;
 else
  select * into person from public.participants where plan_id=pid and guest_token_hash=token_hash;
  if person.id is null then
   if coalesce(length(trim(p_name)),0) not between 1 and 80 then raise exception 'Enter your name'; end if;
   if exists(select 1 from public.participants where plan_id=pid and lower(trim(display_name))=lower(trim(p_name))) then raise exception 'That name is already on the list. Tap it above, or add a surname to use a different name.'; end if;
   if (select count(*) from public.participants where plan_id=pid)>=12 then raise exception 'This party already has 12 people'; end if;
   insert into public.participants(plan_id,id,display_name,origin,position,transport_mode,guest_token_hash,party_join_token)
   values(pid,gen_random_uuid()::text,trim(p_name),'Location not set',coalesce((select max(position)+1 from public.participants where plan_id=pid),0),'either',token_hash,p_guest_token)
   returning * into person;
  end if;
 end if;
 capability:=person.party_join_token;
 if capability is null then
  -- Preserve the original browser capability if it matches. For a legacy name
  -- first opened elsewhere, establish a shared guest-only capability once.
  capability:=case when person.guest_token_hash=token_hash then p_guest_token else encode(extensions.gen_random_bytes(32),'hex') end;
  update public.participants set party_join_token=capability,guest_token_hash=encode(extensions.digest(capability,'sha256'),'hex') where plan_id=pid and id=person.id;
 end if;
 return public.plan_payload(pid)||jsonb_build_object('participant_id',person.id,'guest_token',capability);
end;
$$;
revoke all on function public.join_party(text,text,text,text) from public;
grant execute on function public.join_party(text,text,text,text) to anon,authenticated;
revoke all on public.participants from anon,authenticated;
-- END 202609180001_party_invites.sql

-- BEGIN 202610010001_guest_start_bill.sql
-- Any verified party participant may create the first shared receipt. Once a
-- bill exists, host edits and participant claims keep using the existing RPCs.
create function public.start_guest_bill(
  p_code text,
  p_guest_token text,
  p_service_percent numeric,
  p_gst_percent numeric,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
  found_bill_id uuid;
begin
  if p_guest_token is null or length(p_guest_token) < 32 then
    raise exception 'Guest access is invalid';
  end if;
  if p_service_percent is null or p_gst_percent is null
    or p_service_percent not between 0 and 100 or p_gst_percent not between 0 and 100 then
    raise exception 'Invalid service or tax rate';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 200 then
    raise exception 'Add between 1 and 200 receipt items';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where coalesce(length(trim(item->>'id')), 0) not between 1 and 200
      or coalesce(length(trim(item->>'name')), 0) not between 1 and 300
      or jsonb_typeof(item->'price_cents') <> 'number'
      or (item->>'price_cents')::numeric < 0
      or (item->>'price_cents')::numeric <> trunc((item->>'price_cents')::numeric)
      or jsonb_typeof(coalesce(item->'claimant_ids', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(item->'claimant_ids', '[]'::jsonb)) <> 0
  ) then
    raise exception 'Every receipt item needs an id, name, non-negative price, and no initial claims';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    group by item->>'id' having count(*) > 1
  ) then
    raise exception 'Receipt item ids must be unique';
  end if;

  select plan.id into found_plan_id
  from public.plans plan
  where plan.code = upper(trim(p_code)) and plan.status = 'planning' and plan.expires_at > now()
  for update;
  if found_plan_id is null or not exists (
    select 1 from public.participants participant
    where participant.plan_id = found_plan_id
      and participant.guest_token_hash = encode(extensions.digest(p_guest_token, 'sha256'), 'hex')
  ) then
    raise exception 'Guest access is invalid or the party is closed';
  end if;
  if exists (select 1 from public.bills where plan_id = found_plan_id) then
    raise exception 'A bill already exists. Refresh to claim it.';
  end if;

  insert into public.bills(plan_id, service_percent, gst_percent)
  values(found_plan_id, p_service_percent, p_gst_percent)
  returning id into found_bill_id;

  insert into public.bill_items(bill_id, client_id, name, price_cents, position)
  select found_bill_id, item->>'id', trim(item->>'name'), (item->>'price_cents')::integer, (ordinality - 1)::integer
  from jsonb_array_elements(p_items) with ordinality entries(item, ordinality);

  update public.bills set updated_at = now() where id = found_bill_id;
  return public.bill_payload(found_plan_id);
end;
$$;

revoke all on function public.start_guest_bill(text,text,numeric,numeric,jsonb) from public;
grant execute on function public.start_guest_bill(text,text,numeric,numeric,jsonb) to anon, authenticated;
-- END 202610010001_guest_start_bill.sql

-- BEGIN 202610020001_keep_shared_home.sql
-- A host publish that has not yet seen a friend's home used to store JSON null
-- and erase the home they had just saved. Keep the stored home unless the
-- publish includes a replacement address.
create or replace function public.save_outing(p_code text, p_host_token text, p_participants jsonb, p_venue jsonb, p_meetup_at timestamptz, p_commute_at timestamptz, p_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; current_revision bigint;
begin
 if p_code is null or upper(trim(p_code)) !~ '^[A-HJ-NP-Z2-9]{6}$' or p_host_token is null or length(p_host_token) < 32 then raise exception 'Invalid plan capability'; end if;
 if p_participants is null or jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) not between 1 and 12 then raise exception 'Add between 1 and 12 participants'; end if;
 if exists (select 1 from jsonb_array_elements(p_participants) p where coalesce(length(trim(p->>'id')),0) not between 1 and 120 or coalesce(length(trim(p->>'name')),0) not between 1 and 80 or coalesce(length(trim(p->>'origin')),0) not between 1 and 120 or (p->'location' is not null and p->'location'<>'null'::jsonb and not public.valid_outing_location(p->'location')) or coalesce(p->>'transportMode','either') not in ('train','ride','either')) then raise exception 'Every participant needs a name; any provided location must be valid'; end if;
 p_venue := public.normalize_outing_venue(p_venue);
 select id, revision into pid, current_revision from public.plans where code = upper(trim(p_code)) for update;
 if pid is null then
   if p_revision is not null then raise exception 'Plan expired or was removed'; end if;
   insert into public.plans(code,host_token_hash) values(upper(trim(p_code)),encode(extensions.digest(p_host_token,'sha256'),'hex')) returning id into pid;
 else
   if not exists(select 1 from public.plans where id=pid and host_token_hash=encode(extensions.digest(p_host_token,'sha256'),'hex') and status='planning' and expires_at>now()) then raise exception 'Plan is closed, expired, or host access is invalid'; end if;
   -- Retrying an uncertain initial creation recovers the existing party rather
   -- than overwriting guests who may already have joined it.
   if p_revision is null then return public.plan_payload(pid); end if;
   if p_revision is distinct from current_revision then raise exception 'Plan changed on another device. Refresh before saving; your local edits are retained.'; end if;
 end if;
 delete from public.participants where plan_id=pid and id not in(select p->>'id' from jsonb_array_elements(p_participants) p);
 insert into public.participants(plan_id,id,display_name,origin,position,location,transport_mode)
 select pid,p->>'id',trim(p->>'name'),trim(p->>'origin'),ordinality::integer,p->'location',coalesce(p->>'transportMode','either') from jsonb_array_elements(p_participants) with ordinality as entries(p,ordinality)
 on conflict(plan_id,id) do update set display_name=excluded.display_name, origin=excluded.origin, position=excluded.position,
   location=case when excluded.location is null or excluded.location='null'::jsonb then participants.location else excluded.location end,
   transport_mode=excluded.transport_mode;
 update public.plans set venue_snapshot=p_venue,chosen_venue_id=case when p_venue->>'source'='google_places' then 'google-'||(p_venue->>'providerPlaceId') else p_venue->>'id' end,meetup_at=p_meetup_at,commute_at=p_commute_at,revision=revision+1 where id=pid;
 return public.plan_payload(pid);
end;
$$;
-- END 202610020001_keep_shared_home.sql

-- BEGIN 202610030001_own_row_and_swipe_owner.sql
-- A host publish must not rewrite someone else's home or drop the host,
-- and a swipe belongs to the participant who made it.
drop function if exists public.save_outing(text,text,jsonb,jsonb,timestamptz,timestamptz,bigint);

create function public.save_outing(p_code text, p_host_token text, p_participants jsonb, p_venue jsonb, p_meetup_at timestamptz, p_commute_at timestamptz, p_revision bigint, p_actor_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; current_revision bigint;
begin
 if p_code is null or upper(trim(p_code)) !~ '^[A-HJ-NP-Z2-9]{6}$' or p_host_token is null or length(p_host_token) < 32 then raise exception 'Invalid plan capability'; end if;
 if p_participants is null or jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) not between 1 and 12 then raise exception 'Add between 1 and 12 participants'; end if;
 if exists (select 1 from jsonb_array_elements(p_participants) p where coalesce(length(trim(p->>'id')),0) not between 1 and 120 or coalesce(length(trim(p->>'name')),0) not between 1 and 80 or coalesce(length(trim(p->>'origin')),0) not between 1 and 120 or (p->'location' is not null and p->'location'<>'null'::jsonb and not public.valid_outing_location(p->'location')) or coalesce(p->>'transportMode','either') not in ('train','ride','either')) then raise exception 'Every participant needs a name; any provided location must be valid'; end if;
 p_venue := public.normalize_outing_venue(p_venue);
 select id, revision into pid, current_revision from public.plans where code = upper(trim(p_code)) for update;
 if pid is null then
   if p_revision is not null then raise exception 'Plan expired or was removed'; end if;
   insert into public.plans(code,host_token_hash) values(upper(trim(p_code)),encode(extensions.digest(p_host_token,'sha256'),'hex')) returning id into pid;
 else
   if not exists(select 1 from public.plans where id=pid and host_token_hash=encode(extensions.digest(p_host_token,'sha256'),'hex') and status='planning' and expires_at>now()) then raise exception 'Plan is closed, expired, or host access is invalid'; end if;
   -- Retrying an uncertain initial creation recovers the existing party rather
   -- than overwriting guests who may already have joined it.
   if p_revision is null then return public.plan_payload(pid); end if;
   if p_revision is distinct from current_revision then raise exception 'Plan changed on another device. Refresh before saving; your local edits are retained.'; end if;
 end if;
 delete from public.participants where plan_id=pid and id not in(select p->>'id' from jsonb_array_elements(p_participants) p)
   and (p_actor_id is null or (id is distinct from p_actor_id and (location is null or location='null'::jsonb) and guest_token_hash is null));
 insert into public.participants(plan_id,id,display_name,origin,position,location,transport_mode)
 select pid,p->>'id',trim(p->>'name'),trim(p->>'origin'),ordinality::integer,p->'location',coalesce(p->>'transportMode','either') from jsonb_array_elements(p_participants) with ordinality as entries(p,ordinality)
 on conflict(plan_id,id) do update set
   display_name=case when p_actor_id is not null and participants.id is distinct from p_actor_id then participants.display_name else excluded.display_name end,
   origin=case
     when p_actor_id is not null and participants.id is distinct from p_actor_id then participants.origin
     when excluded.location is null or excluded.location='null'::jsonb then participants.origin
     else excluded.origin end,
   position=case when p_actor_id is not null and participants.id is distinct from p_actor_id then participants.position else excluded.position end,
   location=case
     when p_actor_id is not null and participants.id is distinct from p_actor_id then participants.location
     when excluded.location is null or excluded.location='null'::jsonb then participants.location
     else excluded.location end,
   transport_mode=case when p_actor_id is not null and participants.id is distinct from p_actor_id then participants.transport_mode else excluded.transport_mode end;
 update public.plans set venue_snapshot=p_venue,chosen_venue_id=case when p_venue->>'source'='google_places' then 'google-'||(p_venue->>'providerPlaceId') else p_venue->>'id' end,meetup_at=p_meetup_at,commute_at=p_commute_at,revision=revision+1 where id=pid;
 return public.plan_payload(pid);
end;
$$;
revoke all on function public.save_outing(text,text,jsonb,jsonb,timestamptz,timestamptz,bigint,text) from public;
grant execute on function public.save_outing(text,text,jsonb,jsonb,timestamptz,timestamptz,bigint,text) to anon,authenticated;

-- Host token plus a real participant id stores that person's swipes.
-- A guest token still wins. A host token with no id stays the legacy `host` voter.
create function public.swipe_voter(p_plan uuid, p_token text, p_participant_id text)
returns text language plpgsql stable security definer set search_path='' as $$
declare voter text;
begin
 if p_token is null or length(p_token)<32 then return null; end if;
 if exists(select 1 from public.plans where id=p_plan and host_token_hash=encode(extensions.digest(p_token,'sha256'),'hex')) then
   if p_participant_id is not null and exists(select 1 from public.participants where plan_id=p_plan and id=p_participant_id) then
     return 'guest:'||p_participant_id;
   end if;
   return 'host';
 end if;
 select 'guest:'||id into voter from public.participants where plan_id=p_plan and guest_token_hash=encode(extensions.digest(p_token,'sha256'),'hex');
 return voter;
end;
$$;
revoke all on function public.swipe_voter(uuid,text,text) from public,anon,authenticated;

create or replace function public.get_swipe_state(p_code text) returns jsonb language sql security definer set search_path='' stable as $$
 select jsonb_build_object('venues',coalesce((select venues from public.swipe_decks where plan_id=p.id),'[]'::jsonb),
 'voters',jsonb_build_array('host')||coalesce((select jsonb_agg('guest:'||id order by id) from public.participants where plan_id=p.id),'[]'::jsonb),
 'swipes',coalesce((select jsonb_agg(jsonb_build_object('voterId',s.voter_id,'venueId',s.venue_id,'choice',s.choice,'special',s.special)) from public.venue_swipes s where s.plan_id=p.id and (s.voter_id='host' or exists(select 1 from public.participants where plan_id=p.id and 'guest:'||id=s.voter_id))),'[]'::jsonb))
 from public.plans p where p.code=upper(trim(p_code)) and p.expires_at>now();
$$;

drop function if exists public.start_swipe_deck_with_progress(text,text,jsonb,jsonb);
drop function if exists public.set_restaurant_mention(text,text,text,boolean);
drop function if exists public.set_restaurant_swipe(text,text,text,text);
create function public.set_restaurant_swipe(p_code text,p_token text,p_venue_id text,p_choice text,p_participant_id text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid; voter text;
begin
 if p_choice is null or p_choice not in ('like','pass','neutral') then raise exception 'Invalid swipe'; end if;
 select id into pid from public.plans where code=upper(trim(p_code)) and status='planning' and expires_at>now() for update;
 if pid is null then raise exception 'Plan closed or unavailable'; end if;
 voter:=public.swipe_voter(pid,p_token,p_participant_id);
 if voter is null then raise exception 'Save your entry before swiping'; end if;
 if not exists(select 1 from public.swipe_decks d,jsonb_array_elements(d.venues) v where d.plan_id=pid and public.swipe_venue_key(v)=p_venue_id) then raise exception 'Restaurant is not in the shared shortlist'; end if;
 insert into public.venue_swipes(plan_id,voter_id,venue_id,choice,special) values(pid,voter,p_venue_id,p_choice,false) on conflict(plan_id,voter_id,venue_id) do update set choice=excluded.choice,special=false;
 return public.get_swipe_state(p_code);
end;
$$;
revoke all on function public.set_restaurant_swipe(text,text,text,text,text) from public;
grant execute on function public.set_restaurant_swipe(text,text,text,text,text) to anon,authenticated;

create function public.set_restaurant_mention(p_code text,p_token text,p_venue_id text,p_enabled boolean,p_participant_id text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid; voter text;
begin
 if p_enabled is null then raise exception 'Choose whether to mention this restaurant'; end if;
 perform public.set_restaurant_swipe(p_code,p_token,p_venue_id,'like',p_participant_id);
 select id into pid from public.plans where code=upper(trim(p_code));
 voter:=public.swipe_voter(pid,p_token,p_participant_id);
 update public.venue_swipes set special=p_enabled where plan_id=pid and voter_id=voter and venue_id=p_venue_id;
 return public.get_swipe_state(p_code);
end;
$$;
revoke all on function public.set_restaurant_mention(text,text,text,boolean,text) from public;
grant execute on function public.set_restaurant_mention(text,text,text,boolean,text) to anon,authenticated;

create or replace function public.start_swipe_deck_with_progress(p_code text,p_token text,p_venues jsonb,p_swipes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb; item jsonb; pid uuid; who text;
begin
 if p_swipes is null or jsonb_typeof(p_swipes)<>'array' or jsonb_array_length(p_swipes)>50 then raise exception 'Invalid local progress'; end if;
 payload:=public.start_swipe_deck(p_code,p_token,p_venues);
 select id into pid from public.plans where code=upper(trim(p_code));
 for item in select value from jsonb_array_elements(p_swipes) loop
  who:=case when coalesce(item->>'voterId','') like 'guest:%' then substr(item->>'voterId',7) else null end;
  if who is not null then
   if not exists(select 1 from public.venue_swipes where plan_id=pid and voter_id='guest:'||who and venue_id=item->>'venueId') and exists(select 1 from jsonb_array_elements(payload->'venues') v where public.swipe_venue_key(v)=item->>'venueId') then
    if item->>'choice'='like' and item->'special'='true'::jsonb then
     perform public.set_restaurant_mention(p_code,p_token,item->>'venueId',true,who);
    else
     perform public.set_restaurant_swipe(p_code,p_token,item->>'venueId',item->>'choice',who);
    end if;
   end if;
  elsif not exists(select 1 from public.venue_swipes where plan_id=pid and voter_id='host' and venue_id=item->>'venueId') and exists(select 1 from jsonb_array_elements(payload->'venues') v where public.swipe_venue_key(v)=item->>'venueId') then
   if item->>'choice'='like' and item->'special'='true'::jsonb then
    perform public.set_restaurant_mention(p_code,p_token,item->>'venueId',true);
   else
    perform public.set_restaurant_swipe(p_code,p_token,item->>'venueId',item->>'choice');
   end if;
  end if;
 end loop;
 return public.get_swipe_state(p_code);
end;
$$;
revoke all on function public.start_swipe_deck_with_progress(text,text,jsonb,jsonb) from public;
grant execute on function public.start_swipe_deck_with_progress(text,text,jsonb,jsonb) to anon,authenticated;
-- END 202610030001_own_row_and_swipe_owner.sql

-- BEGIN 202610030002_guest_starting_point.sql
-- A guest can set a Last Call starting point without replacing their home.
-- The extra origin is optional, so a home pin still uses the address label.
drop function if exists public.save_guest_outing(text,text,text,jsonb,text);

create function public.save_guest_outing(
  p_code text,
  p_guest_token text,
  p_name text,
  p_location jsonb,
  p_mode text,
  p_origin text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare payload jsonb; pid uuid; person_id text; origin_text text;
begin
 if not public.valid_outing_location(p_location) or p_mode is null or p_mode not in ('train','ride','either') then raise exception 'Choose a location and travel mode'; end if;
 origin_text := left(coalesce(nullif(trim(p_origin), ''), p_location->>'label'), 120);
 if origin_text is null or char_length(origin_text) not between 1 and 120 then raise exception 'Choose a location and travel mode'; end if;
 select id into pid from public.plans where code=upper(trim(p_code)) and status='planning' and expires_at>now() for update;
 if pid is null then raise exception 'Plan closed or unavailable'; end if;
 if (select count(*) from public.participants where plan_id=pid) >= 12 and not exists(select 1 from public.participants where plan_id=pid and guest_token_hash=encode(extensions.digest(p_guest_token,'sha256'),'hex')) then raise exception 'This plan already has 12 people'; end if;
 payload := public.upsert_guest_participant(p_code,p_guest_token,p_name,origin_text);
 person_id := payload->>'participant_id';
 update public.participants set location=p_location, transport_mode=p_mode, origin=origin_text where plan_id=pid and id=person_id;
 return public.plan_payload(pid) || jsonb_build_object('participant_id', person_id);
end;
$$;

revoke all on function public.save_guest_outing(text,text,text,jsonb,text,text) from public;
grant execute on function public.save_guest_outing(text,text,text,jsonb,text,text) to anon, authenticated;
-- END 202610030002_guest_starting_point.sql

-- BEGIN 202610170001_revert_oct16.sql
-- Undo the 16 Oct schema, newest first:
--   202610160003_outing_ends_at
--   202610160002_clear_restaurant_swipe
--   202610160001_host_participant
-- Function bodies are the pre-#31 definitions. Statements are safe when those
-- objects were never created. Dropping the two added columns removes only
-- those values; plan and participant rows stay.

-- 1. 202610160003_outing_ends_at
-- The wrapper installed there selects plans.ends_at, so put plan_payload back
-- before dropping the column. This is the body from 202609150002_real_outing.sql,
-- the last definition before #31. 001 had renamed that function to
-- plan_payload_before_host and 003 renamed the #31 wrapper to
-- plan_payload_before_outing_end; both leftovers are dropped below.

create or replace function public.plan_payload(p_plan_id uuid) returns jsonb language sql security definer set search_path = '' stable as $$
  select public.legacy_plan_payload(p_plan_id) || jsonb_build_object(
    'chosen_venue', coalesce(plan.venue_snapshot, public.legacy_plan_payload(p_plan_id)->'chosen_venue'),
    'meetup_at', plan.meetup_at, 'commute_at', plan.commute_at, 'revision', plan.revision,
    'participants', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'origin', p.origin, 'location', p.location, 'transportMode', p.transport_mode) order by p.position, p.created_at) from public.participants p where p.plan_id = plan.id), '[]'::jsonb)
  ) from public.plans plan where plan.id = p_plan_id;
$$;
revoke all on function public.legacy_plan_payload(uuid) from public, anon, authenticated;
revoke all on function public.plan_payload(uuid) from public, anon, authenticated;

drop trigger if exists plans_set_ends_at on public.plans;
drop trigger if exists plans_reject_ended_outing on public.plans;
drop trigger if exists participants_reject_ended_outing on public.participants;
drop trigger if exists venues_reject_ended_outing on public.venues;
drop trigger if exists swipe_decks_reject_ended_outing on public.swipe_decks;
drop trigger if exists venue_swipes_reject_ended_outing on public.venue_swipes;
drop trigger if exists venue_votes_reject_ended_outing on public.venue_votes;

drop function if exists public.reject_ended_outing();
drop function if exists public.plans_set_ends_at();
drop function if exists public.outing_ends_at(timestamptz);
drop function if exists public.plan_payload_before_outing_end(uuid);

alter table public.plans drop column if exists ends_at;

-- 2. 202610160002_clear_restaurant_swipe
-- Dropping the function does not put back swipe rows it already deleted.

drop function if exists public.clear_restaurant_swipe(text, text, text, text);

-- 3. 202610160001_host_participant
-- save_outing is the body from 202610030001_own_row_and_swipe_owner.sql.
-- Replace it before dropping host_participant_id, which that later body wrote.

create or replace function public.save_outing(p_code text, p_host_token text, p_participants jsonb, p_venue jsonb, p_meetup_at timestamptz, p_commute_at timestamptz, p_revision bigint, p_actor_id text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; current_revision bigint;
begin
 if p_code is null or upper(trim(p_code)) !~ '^[A-HJ-NP-Z2-9]{6}$' or p_host_token is null or length(p_host_token) < 32 then raise exception 'Invalid plan capability'; end if;
 if p_participants is null or jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) not between 1 and 12 then raise exception 'Add between 1 and 12 participants'; end if;
 if exists (select 1 from jsonb_array_elements(p_participants) p where coalesce(length(trim(p->>'id')),0) not between 1 and 120 or coalesce(length(trim(p->>'name')),0) not between 1 and 80 or coalesce(length(trim(p->>'origin')),0) not between 1 and 120 or (p->'location' is not null and p->'location'<>'null'::jsonb and not public.valid_outing_location(p->'location')) or coalesce(p->>'transportMode','either') not in ('train','ride','either')) then raise exception 'Every participant needs a name; any provided location must be valid'; end if;
 p_venue := public.normalize_outing_venue(p_venue);
 select id, revision into pid, current_revision from public.plans where code = upper(trim(p_code)) for update;
 if pid is null then
   if p_revision is not null then raise exception 'Plan expired or was removed'; end if;
   insert into public.plans(code,host_token_hash) values(upper(trim(p_code)),encode(extensions.digest(p_host_token,'sha256'),'hex')) returning id into pid;
 else
   if not exists(select 1 from public.plans where id=pid and host_token_hash=encode(extensions.digest(p_host_token,'sha256'),'hex') and status='planning' and expires_at>now()) then raise exception 'Plan is closed, expired, or host access is invalid'; end if;
   -- Retrying an uncertain initial creation recovers the existing party rather
   -- than overwriting guests who may already have joined it.
   if p_revision is null then return public.plan_payload(pid); end if;
   if p_revision is distinct from current_revision then raise exception 'Plan changed on another device. Refresh before saving; your local edits are retained.'; end if;
 end if;
 delete from public.participants where plan_id=pid and id not in(select p->>'id' from jsonb_array_elements(p_participants) p)
   and (p_actor_id is null or (id is distinct from p_actor_id and (location is null or location='null'::jsonb) and guest_token_hash is null));
 insert into public.participants(plan_id,id,display_name,origin,position,location,transport_mode)
 select pid,p->>'id',trim(p->>'name'),trim(p->>'origin'),ordinality::integer,p->'location',coalesce(p->>'transportMode','either') from jsonb_array_elements(p_participants) with ordinality as entries(p,ordinality)
 on conflict(plan_id,id) do update set
   display_name=case when p_actor_id is not null and participants.id is distinct from p_actor_id then participants.display_name else excluded.display_name end,
   origin=case
     when p_actor_id is not null and participants.id is distinct from p_actor_id then participants.origin
     when excluded.location is null or excluded.location='null'::jsonb then participants.origin
     else excluded.origin end,
   position=case when p_actor_id is not null and participants.id is distinct from p_actor_id then participants.position else excluded.position end,
   location=case
     when p_actor_id is not null and participants.id is distinct from p_actor_id then participants.location
     when excluded.location is null or excluded.location='null'::jsonb then participants.location
     else excluded.location end,
   transport_mode=case when p_actor_id is not null and participants.id is distinct from p_actor_id then participants.transport_mode else excluded.transport_mode end;
 update public.plans set venue_snapshot=p_venue,chosen_venue_id=case when p_venue->>'source'='google_places' then 'google-'||(p_venue->>'providerPlaceId') else p_venue->>'id' end,meetup_at=p_meetup_at,commute_at=p_commute_at,revision=revision+1 where id=pid;
 return public.plan_payload(pid);
end;
$$;
revoke all on function public.save_outing(text,text,jsonb,jsonb,timestamptz,timestamptz,bigint,text) from public;
grant execute on function public.save_outing(text,text,jsonb,jsonb,timestamptz,timestamptz,bigint,text) to anon,authenticated;

drop function if exists public.plan_payload_before_host(uuid);

alter table public.plans drop column if exists host_participant_id;
-- END 202610170001_revert_oct16.sql

-- BEGIN 202610170002_bill_adjustments.sql
-- Additive: receipt adjustments and the amount actually charged.
-- Existing service/gst rates, items, and claims are left in place.

alter table public.bills
  add column if not exists adjustments jsonb not null default '[]'::jsonb,
  add column if not exists final_total_cents integer;

alter table public.bills
  drop constraint if exists bills_adjustments_are_array;
alter table public.bills
  add constraint bills_adjustments_are_array check (jsonb_typeof(adjustments) = 'array');

alter table public.bills
  drop constraint if exists bills_final_total_nonnegative;
alter table public.bills
  add constraint bills_final_total_nonnegative check (final_total_cents is null or final_total_cents >= 0);

create or replace function public.bill_payload(p_plan_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select public.legacy_bill_payload(p_plan_id) || jsonb_build_object(
    'revision', plan.bill_revision,
    'adjustments', coalesce((
      select bill.adjustments from public.bills bill
      where bill.plan_id = plan.id
      order by bill.created_at desc
      limit 1
    ), '[]'::jsonb),
    'final_total_cents', (
      select bill.final_total_cents from public.bills bill
      where bill.plan_id = plan.id
      order by bill.created_at desc
      limit 1
    )
  )
  from public.plans plan
  where plan.id = p_plan_id;
$$;

revoke all on function public.bill_payload(uuid) from public, anon, authenticated;

create function public.apply_bill_adjustments(p_plan_id uuid, p_adjustments jsonb, p_final_total_cents integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_adjustments is null or jsonb_typeof(p_adjustments) <> 'array' or jsonb_array_length(p_adjustments) > 40 then
    raise exception 'Invalid bill adjustments';
  end if;
  if p_final_total_cents is not null and p_final_total_cents < 0 then
    raise exception 'Invalid final total';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_adjustments) adjustment
    where coalesce(length(trim(adjustment->>'id')), 0) not between 1 and 80
      or coalesce(length(trim(adjustment->>'label')), 0) not between 1 and 80
      or coalesce(adjustment->>'kind', '') not in ('service', 'tax', 'discount', 'rounding', 'other')
      or jsonb_typeof(adjustment->'amount_cents') <> 'number'
      or (adjustment->>'amount_cents')::numeric <> trunc((adjustment->>'amount_cents')::numeric)
      or (adjustment->>'amount_cents')::numeric not between -100000000 and 100000000
      or (
        adjustment ? 'percent'
        and adjustment->'percent' <> 'null'::jsonb
        and (
          jsonb_typeof(adjustment->'percent') <> 'number'
          or (adjustment->>'percent')::numeric < 0
          or (adjustment->>'percent')::numeric > 100
        )
      )
  ) then
    raise exception 'Invalid bill adjustment';
  end if;
  update public.bills
  set adjustments = p_adjustments, final_total_cents = p_final_total_cents
  where id = (
    select id from public.bills
    where plan_id = p_plan_id
    order by created_at desc
    limit 1
  );
end;
$$;

revoke all on function public.apply_bill_adjustments(uuid, jsonb, integer) from public, anon, authenticated;

create function public.save_bill_with_adjustments(
  p_code text,
  p_host_token text,
  p_service_percent numeric,
  p_gst_percent numeric,
  p_items jsonb,
  p_revision bigint,
  p_adjustments jsonb,
  p_final_total_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare found_plan_id uuid;
begin
  perform public.save_bill_checked(p_code, p_host_token, p_service_percent, p_gst_percent, p_items, p_revision);
  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex');
  perform public.apply_bill_adjustments(found_plan_id, p_adjustments, p_final_total_cents);
  return public.bill_payload(found_plan_id);
end;
$$;

revoke all on function public.save_bill_with_adjustments(text, text, numeric, numeric, jsonb, bigint, jsonb, integer) from public;
grant execute on function public.save_bill_with_adjustments(text, text, numeric, numeric, jsonb, bigint, jsonb, integer) to anon, authenticated;

create function public.start_guest_bill_with_adjustments(
  p_code text,
  p_guest_token text,
  p_service_percent numeric,
  p_gst_percent numeric,
  p_items jsonb,
  p_adjustments jsonb,
  p_final_total_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare found_plan_id uuid;
begin
  perform public.start_guest_bill(p_code, p_guest_token, p_service_percent, p_gst_percent, p_items);
  select plan.id into found_plan_id
  from public.plans plan
  join public.participants participant on participant.plan_id = plan.id
  where plan.code = upper(trim(p_code))
    and participant.guest_token_hash = encode(extensions.digest(p_guest_token, 'sha256'), 'hex');
  perform public.apply_bill_adjustments(found_plan_id, p_adjustments, p_final_total_cents);
  return public.bill_payload(found_plan_id);
end;
$$;

revoke all on function public.start_guest_bill_with_adjustments(text, text, numeric, numeric, jsonb, jsonb, integer) from public;
grant execute on function public.start_guest_bill_with_adjustments(text, text, numeric, numeric, jsonb, jsonb, integer) to anon, authenticated;
-- END 202610170002_bill_adjustments.sql

-- BEGIN 202610170003_confirm_bill_total.sql
-- Additive: the host confirms the amount actually paid before anyone claims.
-- Existing items, adjustments, and claims stay. Unconfirmed bills leave both columns null.

alter table public.bills
  add column if not exists confirmed_total_cents integer,
  add column if not exists confirmed_at timestamptz,
  add column if not exists total_revised_at timestamptz;

alter table public.bills
  drop constraint if exists bills_confirmed_total_nonnegative;
alter table public.bills
  add constraint bills_confirmed_total_nonnegative check (confirmed_total_cents is null or confirmed_total_cents >= 0);

alter table public.bills
  drop constraint if exists bills_confirmed_total_pair;
alter table public.bills
  add constraint bills_confirmed_total_pair check (
    (confirmed_total_cents is null and confirmed_at is null)
    or (confirmed_total_cents is not null and confirmed_at is not null)
  );

-- Existing rows are claimable without a confirmed total. Only bills inserted
-- after this migration (the default flips to true) wait for the host.
alter table public.bills
  add column if not exists requires_total_confirmation boolean not null default false;
alter table public.bills
  alter column requires_total_confirmation set default true;

create or replace function public.bill_payload(p_plan_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select public.legacy_bill_payload(p_plan_id) || jsonb_build_object(
    'revision', plan.bill_revision,
    'adjustments', coalesce((
      select bill.adjustments from public.bills bill
      where bill.plan_id = plan.id
      order by bill.created_at desc
      limit 1
    ), '[]'::jsonb),
    'final_total_cents', (
      select bill.final_total_cents from public.bills bill
      where bill.plan_id = plan.id
      order by bill.created_at desc
      limit 1
    ),
    'confirmed_total_cents', (
      select bill.confirmed_total_cents from public.bills bill
      where bill.plan_id = plan.id
      order by bill.created_at desc
      limit 1
    ),
    'confirmed_at', (
      select bill.confirmed_at from public.bills bill
      where bill.plan_id = plan.id
      order by bill.created_at desc
      limit 1
    ),
    'total_revised_at', (
      select bill.total_revised_at from public.bills bill
      where bill.plan_id = plan.id
      order by bill.created_at desc
      limit 1
    ),
    'requires_total_confirmation', (
      select bill.requires_total_confirmation from public.bills bill
      where bill.plan_id = plan.id
      order by bill.created_at desc
      limit 1
    )
  )
  from public.plans plan
  where plan.id = p_plan_id;
$$;

revoke all on function public.bill_payload(uuid) from public, anon, authenticated;

create or replace function public.set_bill_claim(
  p_code text,
  p_guest_token text,
  p_item_id text,
  p_claimed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
  found_participant_id text;
  found_bill_item_id uuid;
  found_requires boolean;
  found_confirmed integer;
begin
  if char_length(p_guest_token) < 32 then
    raise exception 'Invalid guest capability';
  end if;

  select plan.id, participant.id into found_plan_id, found_participant_id
  from public.plans plan
  join public.participants participant on participant.plan_id = plan.id
  where plan.code = upper(trim(p_code))
    and plan.expires_at > now() and plan.status <> 'closed'
    and participant.guest_token_hash = encode(extensions.digest(p_guest_token, 'sha256'), 'hex');
  if found_participant_id is null then
    raise exception 'Guest capability is invalid for this plan';
  end if;

  select item.id, bill.requires_total_confirmation, bill.confirmed_total_cents
    into found_bill_item_id, found_requires, found_confirmed
  from public.bill_items item
  join public.bills bill on bill.id = item.bill_id
  where bill.plan_id = found_plan_id and bill.status = 'claiming' and item.client_id = p_item_id
  order by bill.created_at desc
  limit 1;
  if found_bill_item_id is null then
    raise exception 'This bill item is unavailable';
  end if;
  if found_requires and found_confirmed is null then
    raise exception 'Waiting for host to confirm the total';
  end if;

  if p_claimed then
    insert into public.claims (bill_item_id, plan_id, participant_id)
    values (found_bill_item_id, found_plan_id, found_participant_id)
    on conflict (bill_item_id, participant_id) do nothing;
  else
    delete from public.claims
    where bill_item_id = found_bill_item_id and plan_id = found_plan_id and participant_id = found_participant_id;
  end if;

  return public.bill_payload(found_plan_id);
end;
$$;

create or replace function public.confirm_bill_total(
  p_code text,
  p_host_token text,
  p_confirmed_total_cents integer,
  p_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
  current_revision bigint;
begin
  if p_confirmed_total_cents is null or p_confirmed_total_cents < 0 then
    raise exception 'Invalid confirmed total';
  end if;
  select id, bill_revision into found_plan_id, current_revision
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex')
    and status = 'planning'
    and expires_at > now()
  for update;
  if found_plan_id is null then
    raise exception 'Host access invalid or plan closed';
  end if;
  if p_revision is distinct from current_revision then
    raise exception 'Bill changed on another device. Refresh before saving; your local edits are retained.';
  end if;
  if not exists (select 1 from public.bills where plan_id = found_plan_id) then
    raise exception 'The shared bill is unavailable';
  end if;
  update public.bills
  set confirmed_total_cents = p_confirmed_total_cents,
      confirmed_at = now(),
      final_total_cents = p_confirmed_total_cents
  where id = (
    select id from public.bills
    where plan_id = found_plan_id
    order by created_at desc
    limit 1
  );
  return public.bill_payload(found_plan_id);
end;
$$;

create or replace function public.reopen_bill_confirmation(
  p_code text,
  p_host_token text,
  p_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
  current_revision bigint;
begin
  select id, bill_revision into found_plan_id, current_revision
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex')
    and status = 'planning'
    and expires_at > now()
  for update;
  if found_plan_id is null then
    raise exception 'Host access invalid or plan closed';
  end if;
  if p_revision is distinct from current_revision then
    raise exception 'Bill changed on another device. Refresh before saving; your local edits are retained.';
  end if;
  update public.bills
  set total_revised_at = case when confirmed_at is not null then now() else total_revised_at end,
      confirmed_total_cents = null,
      confirmed_at = null
  where id = (
    select id from public.bills
    where plan_id = found_plan_id
    order by created_at desc
    limit 1
  );
  return public.bill_payload(found_plan_id);
end;
$$;

revoke all on function public.confirm_bill_total(text, text, integer, bigint) from public;
revoke all on function public.reopen_bill_confirmation(text, text, bigint) from public;
grant execute on function public.confirm_bill_total(text, text, integer, bigint) to anon, authenticated;
grant execute on function public.reopen_bill_confirmation(text, text, bigint) to anon, authenticated;
-- END 202610170003_confirm_bill_total.sql
