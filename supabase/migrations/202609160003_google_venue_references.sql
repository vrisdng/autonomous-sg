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

