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
