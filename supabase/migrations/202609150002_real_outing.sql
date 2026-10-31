alter table public.plans add column meetup_at timestamptz;
alter table public.plans add column commute_at timestamptz;
alter table public.plans add column venue_snapshot jsonb;
alter table public.plans add column revision bigint not null default 0;
alter table public.plans add column bill_revision bigint not null default 0;
alter table public.participants add column location jsonb;

alter function public.plan_payload(uuid) rename to legacy_plan_payload;
create function public.plan_payload(p_plan_id uuid) returns jsonb language sql security definer set search_path = '' stable as $$
  select public.legacy_plan_payload(p_plan_id) || jsonb_build_object(
    'chosen_venue', coalesce(plan.venue_snapshot, public.legacy_plan_payload(p_plan_id)->'chosen_venue'),
    'meetup_at', plan.meetup_at, 'commute_at', plan.commute_at, 'revision', plan.revision,
    'participants', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.display_name, 'origin', p.origin, 'location', p.location, 'transportMode', p.transport_mode) order by p.position, p.created_at) from public.participants p where p.plan_id = plan.id), '[]'::jsonb)
  ) from public.plans plan where plan.id = p_plan_id;
$$;
revoke all on function public.legacy_plan_payload(uuid) from public, anon, authenticated;
revoke all on function public.plan_payload(uuid) from public, anon, authenticated;

create function public.valid_outing_location(p_location jsonb) returns boolean language sql immutable set search_path = '' as $$
 select coalesce(jsonb_typeof(p_location) = 'object' and jsonb_typeof(p_location->'label') = 'string'
   and length(p_location->>'label') between 1 and 300
   and jsonb_typeof(p_location->'latitude') = 'number' and jsonb_typeof(p_location->'longitude') = 'number'
   and (p_location->>'latitude')::numeric between 1.1 and 1.6 and (p_location->>'longitude')::numeric between 103.5 and 104.2, false);
$$;

create function public.bump_outing_revision() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 update public.plans set revision = revision + 1 where id = case when tg_op = 'DELETE' then old.plan_id else new.plan_id end;
 return case when tg_op = 'DELETE' then old else new end;
end;
$$;
create trigger participants_revision before insert or update or delete on public.participants for each row execute function public.bump_outing_revision();

create function public.save_outing(p_code text, p_host_token text, p_participants jsonb, p_venue jsonb, p_meetup_at timestamptz, p_commute_at timestamptz, p_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; current_revision bigint;
begin
 if p_code is null or upper(trim(p_code)) !~ '^[A-HJ-NP-Z2-9]{6}$' or p_host_token is null or length(p_host_token) < 32 then raise exception 'Invalid plan capability'; end if;
 if p_participants is null or jsonb_typeof(p_participants) <> 'array' or jsonb_array_length(p_participants) not between 1 and 12 then raise exception 'Add between 1 and 12 participants'; end if;
 if exists (select 1 from jsonb_array_elements(p_participants) p where coalesce(length(trim(p->>'id')),0) not between 1 and 120 or coalesce(length(trim(p->>'name')),0) not between 1 and 80 or coalesce(length(trim(p->>'origin')),0) not between 1 and 120 or not public.valid_outing_location(p->'location') or coalesce(p->>'transportMode','either') not in ('train','ride','either')) then raise exception 'Every participant needs a name and a confirmed location'; end if;
 if p_venue is not null and (coalesce(p_venue->>'source','') not in ('verified','onemap') or coalesce(length(p_venue->>'name'),0) not between 1 and 160 or not public.valid_outing_location(jsonb_build_object('label',p_venue->>'name','latitude',p_venue->'latitude','longitude',p_venue->'longitude'))) then raise exception 'Choose a real venue'; end if;
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
 update public.plans set venue_snapshot=p_venue,chosen_venue_id=p_venue->>'id',meetup_at=p_meetup_at,commute_at=p_commute_at,revision=revision+1 where id=pid;
 return public.plan_payload(pid);
end;
$$;

create function public.save_guest_outing(p_code text,p_guest_token text,p_name text,p_location jsonb,p_mode text) returns jsonb language plpgsql security definer set search_path = '' as $$
declare payload jsonb; pid uuid; person_id text;
begin
 if not public.valid_outing_location(p_location) or p_mode is null or p_mode not in ('train','ride','either') then raise exception 'Choose a location and travel mode'; end if;
 select id into pid from public.plans where code=upper(trim(p_code)) and status='planning' and expires_at>now() for update;
 if pid is null then raise exception 'Plan closed or unavailable'; end if;
 if (select count(*) from public.participants where plan_id=pid) >= 12 and not exists(select 1 from public.participants where plan_id=pid and guest_token_hash=encode(extensions.digest(p_guest_token,'sha256'),'hex')) then raise exception 'This plan already has 12 people'; end if;
 payload := public.upsert_guest_participant(p_code,p_guest_token,p_name,left(p_location->>'label',120));
 person_id := payload->>'participant_id';
 update public.participants set location=p_location,transport_mode=p_mode where plan_id=pid and id=person_id;
 return public.plan_payload(pid) || jsonb_build_object('participant_id',person_id);
end;
$$;
revoke all on function public.save_outing(text,text,jsonb,jsonb,timestamptz,timestamptz,bigint) from public;
revoke all on function public.save_guest_outing(text,text,text,jsonb,text) from public;
grant execute on function public.save_outing(text,text,jsonb,jsonb,timestamptz,timestamptz,bigint) to anon,authenticated;
grant execute on function public.save_guest_outing(text,text,text,jsonb,text) to anon,authenticated;
revoke all on function public.bump_outing_revision() from public,anon,authenticated;

-- Block older clients from bypassing version checks during host edits.
revoke execute on function public.update_plan(text,text,jsonb,text) from anon,authenticated;
revoke execute on function public.set_plan_venue(text,text,jsonb) from anon,authenticated;
revoke execute on function public.set_plan_transport_modes(text,text,jsonb) from anon,authenticated;

alter function public.bill_payload(uuid) rename to legacy_bill_payload;
create function public.bill_payload(p_plan_id uuid) returns jsonb language sql security definer set search_path = '' stable as $$
 select public.legacy_bill_payload(p_plan_id) || jsonb_build_object('revision',bill_revision) from public.plans where id=p_plan_id;
$$;
revoke all on function public.legacy_bill_payload(uuid) from public,anon,authenticated;
revoke all on function public.bill_payload(uuid) from public,anon,authenticated;
create function public.bump_bill_revision() returns trigger language plpgsql security definer set search_path = '' as $$
declare pid uuid;
begin
 if tg_table_name='bill_items' then
   select plan_id into pid from public.bills where id=case when tg_op='DELETE' then old.bill_id else new.bill_id end;
 else pid := case when tg_op='DELETE' then old.plan_id else new.plan_id end;
 end if;
 update public.plans set bill_revision=bill_revision+1 where id=pid;
 return case when tg_op='DELETE' then old else new end;
end;
$$;
create trigger bill_items_revision before insert or update or delete on public.bill_items for each row execute function public.bump_bill_revision();
create trigger claims_revision before insert or update or delete on public.claims for each row execute function public.bump_bill_revision();
create trigger bills_revision before insert or update or delete on public.bills for each row execute function public.bump_bill_revision();
create trigger settlements_revision before insert or update or delete on public.payment_settlements for each row execute function public.bump_bill_revision();
create function public.save_bill_checked(p_code text,p_host_token text,p_service_percent numeric,p_gst_percent numeric,p_items jsonb,p_revision bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare pid uuid; current_revision bigint;
begin
 select id,bill_revision into pid,current_revision from public.plans where code=upper(trim(p_code)) and host_token_hash=encode(extensions.digest(p_host_token,'sha256'),'hex') and status='planning' and expires_at>now() for update;
 if p_service_percent is null or p_gst_percent is null or p_service_percent not between 0 and 100 or p_gst_percent not between 0 and 100 then raise exception 'Invalid service or tax rate'; end if;
 if pid is null then raise exception 'Host access invalid or plan closed'; end if;
 if p_revision is distinct from current_revision then raise exception 'Bill changed on another device. Refresh before saving; your local edits are retained.'; end if;
 return public.save_bill(p_code,p_host_token,p_service_percent,p_gst_percent,p_items);
end;
$$;
revoke all on function public.bump_bill_revision() from public,anon,authenticated;
revoke execute on function public.save_bill(text,text,numeric,numeric,jsonb) from anon,authenticated;
revoke all on function public.save_bill_checked(text,text,numeric,numeric,jsonb,bigint) from public;
grant execute on function public.save_bill_checked(text,text,numeric,numeric,jsonb,bigint) to anon,authenticated;

create table public.travel_quota(bucket text primary key, window_start timestamptz not null, requests integer not null);
alter table public.travel_quota enable row level security;
create function public.consume_travel_quota(p_bucket text) returns boolean language plpgsql security definer set search_path = '' as $$
declare per_client integer; global_requests integer;
begin
 delete from public.travel_quota where window_start < now()-interval '1 day';
 insert into public.travel_quota values('global',now(),1) on conflict(bucket) do update set requests=case when travel_quota.window_start < now()-interval '1 minute' then 1 else travel_quota.requests+1 end,window_start=case when travel_quota.window_start < now()-interval '1 minute' then now() else travel_quota.window_start end returning requests into global_requests;
 insert into public.travel_quota values(p_bucket,now(),1) on conflict(bucket) do update set requests=case when travel_quota.window_start < now()-interval '1 minute' then 1 else travel_quota.requests+1 end,window_start=case when travel_quota.window_start < now()-interval '1 minute' then now() else travel_quota.window_start end returning requests into per_client;
 return per_client<=30 and global_requests<=120;
end;
$$;
revoke all on function public.consume_travel_quota(text) from public,anon,authenticated;
grant execute on function public.consume_travel_quota(text) to service_role;
