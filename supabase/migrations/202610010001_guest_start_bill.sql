-- Any verified party participant may create the first shared receipt. Once a
-- bill exists, host edits and participant claims keep using the existing RPCs.
create function public.start_guest_bill(
  p_code text,
  p_guest_token text,
  p_service_percent numeric,
  p_gst_percent numeric,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
  found_bill_id uuid;
begin
  if p_guest_token is null or length(p_guest_token) < 32 then
    raise exception 'Guest access is invalid';
  end if;
  if p_service_percent is null or p_gst_percent is null
    or p_service_percent not between 0 and 100 or p_gst_percent not between 0 and 100 then
    raise exception 'Invalid service or tax rate';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) not between 1 and 200 then
    raise exception 'Add between 1 and 200 receipt items';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where coalesce(length(trim(item->>'id')), 0) not between 1 and 200
      or coalesce(length(trim(item->>'name')), 0) not between 1 and 300
      or jsonb_typeof(item->'price_cents') <> 'number'
      or (item->>'price_cents')::numeric < 0
      or (item->>'price_cents')::numeric <> trunc((item->>'price_cents')::numeric)
      or jsonb_typeof(coalesce(item->'claimant_ids', '[]'::jsonb)) <> 'array'
      or jsonb_array_length(coalesce(item->'claimant_ids', '[]'::jsonb)) <> 0
  ) then
    raise exception 'Every receipt item needs an id, name, non-negative price, and no initial claims';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) item
    group by item->>'id' having count(*) > 1
  ) then
    raise exception 'Receipt item ids must be unique';
  end if;

  select plan.id into found_plan_id
  from public.plans plan
  where plan.code = upper(trim(p_code)) and plan.status = 'planning' and plan.expires_at > now()
  for update;
  if found_plan_id is null or not exists (
    select 1 from public.participants participant
    where participant.plan_id = found_plan_id
      and participant.guest_token_hash = encode(extensions.digest(p_guest_token, 'sha256'), 'hex')
  ) then
    raise exception 'Guest access is invalid or the party is closed';
  end if;
  if exists (select 1 from public.bills where plan_id = found_plan_id) then
    raise exception 'A bill already exists. Refresh to claim it.';
  end if;

  insert into public.bills(plan_id, service_percent, gst_percent)
  values(found_plan_id, p_service_percent, p_gst_percent)
  returning id into found_bill_id;

  insert into public.bill_items(bill_id, client_id, name, price_cents, position)
  select found_bill_id, item->>'id', trim(item->>'name'), (item->>'price_cents')::integer, (ordinality - 1)::integer
  from jsonb_array_elements(p_items) with ordinality entries(item, ordinality);

  update public.bills set updated_at = now() where id = found_bill_id;
  return public.bill_payload(found_plan_id);
end;
$$;

revoke all on function public.start_guest_bill(text,text,numeric,numeric,jsonb) from public;
grant execute on function public.start_guest_bill(text,text,numeric,numeric,jsonb) to anon, authenticated;
