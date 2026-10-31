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
