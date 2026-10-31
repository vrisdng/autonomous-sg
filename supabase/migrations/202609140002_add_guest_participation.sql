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
