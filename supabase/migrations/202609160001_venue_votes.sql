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
