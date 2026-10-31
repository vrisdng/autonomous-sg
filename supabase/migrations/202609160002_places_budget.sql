-- Places content is deliberately not stored here. Only request counters.
create table public.places_request_budget (
  bucket text primary key,
  window_start timestamptz not null,
  requests integer not null check (requests >= 0)
);
alter table public.places_request_budget enable row level security;
revoke all on public.places_request_budget from public, anon, authenticated;

create function public.consume_places_budget(p_bucket text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare month_start timestamptz; used integer; client_used integer;
begin
  if p_bucket is null or p_bucket !~ '^[a-f0-9]{64}$' then return false; end if;
  -- Google billing months use Pacific time. Reserve before every attempt; no retries.
  month_start := date_trunc('month', now() at time zone 'America/Los_Angeles') at time zone 'America/Los_Angeles';
  insert into public.places_request_budget values ('nearby-enterprise', month_start, 0)
    on conflict (bucket) do nothing;
  select requests into used from public.places_request_budget where bucket='nearby-enterprise' for update;
  update public.places_request_budget set requests=0, window_start=month_start
    where bucket='nearby-enterprise' and window_start < month_start;
  select requests into used from public.places_request_budget where bucket='nearby-enterprise';
  if used >= 900 then return false; end if;
  delete from public.places_request_budget where bucket <> 'nearby-enterprise' and window_start < now()-interval '1 day';
  insert into public.places_request_budget values (p_bucket, now(), 0) on conflict (bucket) do nothing;
  update public.places_request_budget set requests=0, window_start=now()
    where bucket=p_bucket and window_start < now()-interval '1 hour';
  select requests into client_used from public.places_request_budget where bucket=p_bucket;
  if client_used >= 10 then return false; end if;
  update public.places_request_budget set requests=requests+1 where bucket in ('nearby-enterprise',p_bucket);
  return true;
end;
$$;
revoke all on function public.consume_places_budget(text) from public, anon, authenticated;
grant execute on function public.consume_places_budget(text) to service_role;
