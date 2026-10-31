-- A guest can set a Last Call starting point without replacing their home.
-- The extra origin is optional, so a home pin still uses the address label.
drop function if exists public.save_guest_outing(text,text,text,jsonb,text);

create function public.save_guest_outing(
  p_code text,
  p_guest_token text,
  p_name text,
  p_location jsonb,
  p_mode text,
  p_origin text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare payload jsonb; pid uuid; person_id text; origin_text text;
begin
 if not public.valid_outing_location(p_location) or p_mode is null or p_mode not in ('train','ride','either') then raise exception 'Choose a location and travel mode'; end if;
 origin_text := left(coalesce(nullif(trim(p_origin), ''), p_location->>'label'), 120);
 if origin_text is null or char_length(origin_text) not between 1 and 120 then raise exception 'Choose a location and travel mode'; end if;
 select id into pid from public.plans where code=upper(trim(p_code)) and status='planning' and expires_at>now() for update;
 if pid is null then raise exception 'Plan closed or unavailable'; end if;
 if (select count(*) from public.participants where plan_id=pid) >= 12 and not exists(select 1 from public.participants where plan_id=pid and guest_token_hash=encode(extensions.digest(p_guest_token,'sha256'),'hex')) then raise exception 'This plan already has 12 people'; end if;
 payload := public.upsert_guest_participant(p_code,p_guest_token,p_name,origin_text);
 person_id := payload->>'participant_id';
 update public.participants set location=p_location, transport_mode=p_mode, origin=origin_text where plan_id=pid and id=person_id;
 return public.plan_payload(pid) || jsonb_build_object('participant_id', person_id);
end;
$$;

revoke all on function public.save_guest_outing(text,text,text,jsonb,text,text) from public;
grant execute on function public.save_guest_outing(text,text,text,jsonb,text,text) to anon, authenticated;
