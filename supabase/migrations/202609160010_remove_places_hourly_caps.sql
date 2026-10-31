-- User requested removal of hourly enforcement too. Retain metering, validation and permissions.
create or replace function public.consume_places_budget(p_bucket text, p_sku text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare month_start timestamptz; used integer; client_used integer;
begin
  if p_sku is null or p_sku not in ('nearby-enterprise','details-enterprise','photos','reviews') then return false; end if;
  if p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$' then return false; end if;
  -- Google billing months use Pacific time. Reserve before every attempt; no retries.
  month_start := date_trunc('month', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  insert into public.places_request_budget values (p_sku, month_start, 0)
    on conflict (bucket) do nothing;
  select requests into used from public.places_request_budget where bucket=p_sku for update;
  update public.places_request_budget set requests=0, window_start=month_start
    where bucket=p_sku and window_start < month_start;
  select requests into used from public.places_request_budget where bucket=p_sku;
  delete from public.places_request_budget where bucket not in ('nearby-enterprise','details-enterprise','photos','reviews') and window_start < now()-interval '1 day';
  insert into public.places_request_budget values (p_sku||':'||p_bucket, now(), 0) on conflict (bucket) do nothing;
  update public.places_request_budget set requests=0, window_start=now()
    where bucket=p_sku||':'||p_bucket and window_start < now()-interval '1 hour';
  select requests into client_used from public.places_request_budget where bucket=p_sku||':'||p_bucket;
  update public.places_request_budget set requests=requests+1 where bucket in (p_sku,p_sku||':'||p_bucket);
  return true;
end;
$$;
revoke all on function public.consume_places_budget(text,text) from public, anon, authenticated;
grant execute on function public.consume_places_budget(text,text) to service_role;
