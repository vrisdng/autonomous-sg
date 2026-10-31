create or replace function public.plan_payload(p_plan_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'code', plan.code,
    'chosen_venue_id', plan.chosen_venue_id,
    'status', plan.status,
    'expires_at', plan.expires_at,
    'participants', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', participant.id, 'name', participant.display_name, 'origin', participant.origin)
        order by participant.position, participant.created_at
      )
      from public.participants participant
      where participant.plan_id = plan.id
    ), '[]'::jsonb)
  )
  from public.plans plan
  where plan.id = p_plan_id;
$$;

create or replace function public.get_plan(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  found_plan_id uuid;
begin
  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code)) and expires_at > now();
  if found_plan_id is null then
    raise exception 'This plan is unavailable or has expired';
  end if;
  return public.plan_payload(found_plan_id);
end;
$$;

create or replace function public.set_plan_status(
  p_code text,
  p_host_token text,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
begin
  if p_status not in ('planning', 'closed') then
    raise exception 'Invalid plan status';
  end if;
  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex');
  if found_plan_id is null then
    raise exception 'Plan not found or host capability is invalid';
  end if;
  update public.plans set status = p_status where id = found_plan_id;
  return public.plan_payload(found_plan_id);
end;
$$;

create or replace function public.extend_plan_expiry(
  p_code text,
  p_host_token text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
begin
  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex');
  if found_plan_id is null then
    raise exception 'Plan not found or host capability is invalid';
  end if;
  update public.plans set expires_at = now() + interval '30 days' where id = found_plan_id;
  return public.plan_payload(found_plan_id);
end;
$$;

create or replace function public.delete_plan(
  p_code text,
  p_host_token text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count integer;
begin
  delete from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex');
  get diagnostics deleted_count = row_count;
  if deleted_count <> 1 then
    raise exception 'Plan not found or host capability is invalid';
  end if;
  return true;
end;
$$;

revoke execute on function public.set_plan_status(text, text, text) from public;
revoke execute on function public.extend_plan_expiry(text, text) from public;
revoke execute on function public.delete_plan(text, text) from public;
grant execute on function public.set_plan_status(text, text, text) to anon, authenticated;
grant execute on function public.extend_plan_expiry(text, text) to anon, authenticated;
grant execute on function public.delete_plan(text, text) to anon, authenticated;
