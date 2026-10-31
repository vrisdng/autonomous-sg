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
