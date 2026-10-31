-- Name-first invitations. Name selection is intentionally open to holders of
-- the party code; it never grants the host capability. Tokens are excluded from
-- public plan payloads and direct table access is denied.
alter table public.participants add column party_join_token text;
create or replace function public.save_outing(p_code text, p_host_token text, p_participants jsonb, p_venue jsonb, p_meetup_at timestamptz, p_commute_at timestamptz, p_revision bigint)
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
 delete from public.participants where plan_id=pid and id not in(select p->>'id' from jsonb_array_elements(p_participants) p);
 insert into public.participants(plan_id,id,display_name,origin,position,location,transport_mode)
 select pid,p->>'id',trim(p->>'name'),trim(p->>'origin'),ordinality::integer,p->'location',coalesce(p->>'transportMode','either') from jsonb_array_elements(p_participants) with ordinality as entries(p,ordinality)
 on conflict(plan_id,id) do update set display_name=excluded.display_name, origin=excluded.origin, position=excluded.position, location=excluded.location, transport_mode=excluded.transport_mode;
 update public.plans set venue_snapshot=p_venue,chosen_venue_id=case when p_venue->>'source'='google_places' then 'google-'||(p_venue->>'providerPlaceId') else p_venue->>'id' end,meetup_at=p_meetup_at,commute_at=p_commute_at,revision=revision+1 where id=pid;
 return public.plan_payload(pid);
end;
$$;

create function public.join_party(p_code text,p_name text,p_participant_id text,p_guest_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid; person public.participants%rowtype; capability text; token_hash text;
begin
 if p_code is null or upper(trim(p_code)) !~ '^[A-HJ-NP-Z2-9]{6}$' or p_guest_token is null or length(p_guest_token) not between 32 and 128 then raise exception 'Invalid party entry'; end if;
 select id into pid from public.plans where code=upper(trim(p_code)) and status='planning' and expires_at>now() for update;
 if pid is null then raise exception 'This party is closed or unavailable'; end if;
 token_hash:=encode(extensions.digest(p_guest_token,'sha256'),'hex');
 if p_participant_id is not null then
  select * into person from public.participants where plan_id=pid and id=p_participant_id;
  if person.id is null then raise exception 'That person is no longer in the party. Reopen the invite.'; end if;
 else
  select * into person from public.participants where plan_id=pid and guest_token_hash=token_hash;
  if person.id is null then
   if coalesce(length(trim(p_name)),0) not between 1 and 80 then raise exception 'Enter your name'; end if;
   if exists(select 1 from public.participants where plan_id=pid and lower(trim(display_name))=lower(trim(p_name))) then raise exception 'That name is already on the list. Tap it above, or add a surname to use a different name.'; end if;
   if (select count(*) from public.participants where plan_id=pid)>=12 then raise exception 'This party already has 12 people'; end if;
   insert into public.participants(plan_id,id,display_name,origin,position,transport_mode,guest_token_hash,party_join_token)
   values(pid,gen_random_uuid()::text,trim(p_name),'Location not set',coalesce((select max(position)+1 from public.participants where plan_id=pid),0),'either',token_hash,p_guest_token)
   returning * into person;
  end if;
 end if;
 capability:=person.party_join_token;
 if capability is null then
  -- Preserve the original browser capability if it matches. For a legacy name
  -- first opened elsewhere, establish a shared guest-only capability once.
  capability:=case when person.guest_token_hash=token_hash then p_guest_token else encode(extensions.gen_random_bytes(32),'hex') end;
  update public.participants set party_join_token=capability,guest_token_hash=encode(extensions.digest(capability,'sha256'),'hex') where plan_id=pid and id=person.id;
 end if;
 return public.plan_payload(pid)||jsonb_build_object('participant_id',person.id,'guest_token',capability);
end;
$$;
revoke all on function public.join_party(text,text,text,text) from public;
grant execute on function public.join_party(text,text,text,text) to anon,authenticated;
revoke all on public.participants from anon,authenticated;
