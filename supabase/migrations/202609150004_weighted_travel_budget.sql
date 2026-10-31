-- Reserve worst-case external work, including one token refresh/retry, before
-- issuing provider calls. Counters are shared across all Edge instances.
create function public.consume_travel_budget(p_bucket text, p_units integer)
returns boolean language plpgsql security definer set search_path = '' as $$
declare per_client integer; global_requests integer;
begin
 if p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$' or p_units is null or p_units < 1 or p_units > 14 then return false; end if;
 delete from public.travel_quota where window_start < now()-interval '1 day';
 insert into public.travel_quota values('provider-budget',now(),p_units)
 on conflict(bucket) do update set requests=case when travel_quota.window_start < now()-interval '1 minute' then p_units else travel_quota.requests+p_units end,
 window_start=case when travel_quota.window_start < now()-interval '1 minute' then now() else travel_quota.window_start end returning requests into global_requests;
 insert into public.travel_quota values('budget-' || p_bucket,now(),p_units)
 on conflict(bucket) do update set requests=case when travel_quota.window_start < now()-interval '1 minute' then p_units else travel_quota.requests+p_units end,
 window_start=case when travel_quota.window_start < now()-interval '1 minute' then now() else travel_quota.window_start end returning requests into per_client;
 return per_client<=160 and global_requests<=200;
end;
$$;
revoke all on function public.consume_travel_budget(text,integer) from public,anon,authenticated;
grant execute on function public.consume_travel_budget(text,integer) to service_role;
