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
