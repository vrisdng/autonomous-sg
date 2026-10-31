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
