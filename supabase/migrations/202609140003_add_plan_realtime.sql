create or replace function public.broadcast_plan_invalidation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_plan_id uuid;
  affected_plan_code text;
begin
  if tg_table_name = 'plans' then
    affected_plan_code := case when tg_op = 'DELETE' then old.code else new.code end;
  else
    affected_plan_id := case when tg_op = 'DELETE' then old.plan_id else new.plan_id end;
    select code into affected_plan_code from public.plans where id = affected_plan_id;
  end if;

  if affected_plan_code is not null then
    perform realtime.send(
      jsonb_build_object('changed_at', pg_catalog.clock_timestamp()),
      'plan_changed',
      'plan:' || affected_plan_code,
      false
    );
  end if;
  return null;
end;
$$;

create trigger plans_broadcast_invalidation
after insert or update or delete on public.plans
for each row execute function public.broadcast_plan_invalidation();

create trigger participants_broadcast_invalidation
after insert or update or delete on public.participants
for each row execute function public.broadcast_plan_invalidation();

revoke execute on function public.broadcast_plan_invalidation() from public, anon, authenticated;
