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
