create function public.refresh_swipe_deck(p_code text,p_token text,p_venues jsonb,p_expected jsonb,p_append boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare pid uuid; old jsonb; clean jsonb; v jsonb;
begin
 select id into pid from public.plans where code=upper(trim(p_code)) and status='planning' and expires_at>now() and length(p_token)>=32 and host_token_hash=encode(extensions.digest(p_token,'sha256'),'hex') for update;
 if pid is null then raise exception 'Only the host of an open plan can change restaurants'; end if;
 select venues into old from public.swipe_decks where plan_id=pid;
 if coalesce(old,'[]'::jsonb) is distinct from p_expected then raise exception 'Restaurant list changed. Refresh progress and try again.'; end if;
 if p_venues is null or jsonb_typeof(p_venues)<>'array' or jsonb_array_length(p_venues) not between 1 and 20 then raise exception 'Choose 1 to 20 restaurants per search'; end if;
 clean:=case when p_append then coalesce(old,'[]'::jsonb) else '[]'::jsonb end;
 for v in select value from jsonb_array_elements(p_venues) loop
  v:=public.normalize_outing_venue(v);
  if v is null then raise exception 'Invalid restaurant'; end if;
  if not exists(select 1 from jsonb_array_elements(clean) x where public.swipe_venue_key(x)=public.swipe_venue_key(v)) then clean:=clean||jsonb_build_array(v); end if;
 end loop;
 if jsonb_array_length(clean)>60 then raise exception 'This outing has reached 60 restaurant cards. Choose a new area to replace the list.'; end if;
 insert into public.swipe_decks values(pid,clean) on conflict(plan_id) do update set venues=excluded.venues;
 -- Retain old ratings; only venues in the active deck participate in ranking.
 return public.get_swipe_state(p_code);
end;
$$;
revoke all on function public.refresh_swipe_deck(text,text,jsonb,jsonb,boolean) from public;
grant execute on function public.refresh_swipe_deck(text,text,jsonb,jsonb,boolean) to anon,authenticated;
