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
