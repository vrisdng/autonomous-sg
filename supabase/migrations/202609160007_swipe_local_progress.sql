-- Atomically preserve the host's device-only ratings when publishing a deck.
-- Existing shared ratings take precedence over older local records.
create function public.start_swipe_deck_with_progress(p_code text,p_token text,p_venues jsonb,p_swipes jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare payload jsonb; item jsonb; pid uuid;
begin
 if p_swipes is null or jsonb_typeof(p_swipes)<>'array' or jsonb_array_length(p_swipes)>50 then raise exception 'Invalid local progress'; end if;
 payload:=public.start_swipe_deck(p_code,p_token,p_venues);
 select id into pid from public.plans where code=upper(trim(p_code));
 for item in select value from jsonb_array_elements(p_swipes) loop
  if not exists(select 1 from public.venue_swipes where plan_id=pid and voter_id='host' and venue_id=item->>'venueId') and exists(select 1 from jsonb_array_elements(payload->'venues') v where public.swipe_venue_key(v)=item->>'venueId') then
   perform public.set_restaurant_swipe(p_code,p_token,item->>'venueId',item->>'choice');
  end if;
 end loop;
 return public.get_swipe_state(p_code);
end;
$$;
revoke all on function public.start_swipe_deck_with_progress(text,text,jsonb,jsonb) from public;
grant execute on function public.start_swipe_deck_with_progress(text,text,jsonb,jsonb) to anon,authenticated;
