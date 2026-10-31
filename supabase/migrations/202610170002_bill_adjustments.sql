-- Additive: receipt adjustments and the amount actually charged.
-- Existing service/gst rates, items, and claims are left in place.

alter table public.bills
  add column if not exists adjustments jsonb not null default '[]'::jsonb,
  add column if not exists final_total_cents integer;

alter table public.bills
  drop constraint if exists bills_adjustments_are_array;
alter table public.bills
  add constraint bills_adjustments_are_array check (jsonb_typeof(adjustments) = 'array');

alter table public.bills
  drop constraint if exists bills_final_total_nonnegative;
alter table public.bills
  add constraint bills_final_total_nonnegative check (final_total_cents is null or final_total_cents >= 0);

create or replace function public.bill_payload(p_plan_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select public.legacy_bill_payload(p_plan_id) || jsonb_build_object(
    'revision', plan.bill_revision,
    'adjustments', coalesce((
      select bill.adjustments from public.bills bill
      where bill.plan_id = plan.id
      order by bill.created_at desc
      limit 1
    ), '[]'::jsonb),
    'final_total_cents', (
      select bill.final_total_cents from public.bills bill
      where bill.plan_id = plan.id
      order by bill.created_at desc
      limit 1
    )
  )
  from public.plans plan
  where plan.id = p_plan_id;
$$;

revoke all on function public.bill_payload(uuid) from public, anon, authenticated;

create function public.apply_bill_adjustments(p_plan_id uuid, p_adjustments jsonb, p_final_total_cents integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_adjustments is null or jsonb_typeof(p_adjustments) <> 'array' or jsonb_array_length(p_adjustments) > 40 then
    raise exception 'Invalid bill adjustments';
  end if;
  if p_final_total_cents is not null and p_final_total_cents < 0 then
    raise exception 'Invalid final total';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_adjustments) adjustment
    where coalesce(length(trim(adjustment->>'id')), 0) not between 1 and 80
      or coalesce(length(trim(adjustment->>'label')), 0) not between 1 and 80
      or coalesce(adjustment->>'kind', '') not in ('service', 'tax', 'discount', 'rounding', 'other')
      or jsonb_typeof(adjustment->'amount_cents') <> 'number'
      or (adjustment->>'amount_cents')::numeric <> trunc((adjustment->>'amount_cents')::numeric)
      or (adjustment->>'amount_cents')::numeric not between -100000000 and 100000000
      or (
        adjustment ? 'percent'
        and adjustment->'percent' <> 'null'::jsonb
        and (
          jsonb_typeof(adjustment->'percent') <> 'number'
          or (adjustment->>'percent')::numeric < 0
          or (adjustment->>'percent')::numeric > 100
        )
      )
  ) then
    raise exception 'Invalid bill adjustment';
  end if;
  update public.bills
  set adjustments = p_adjustments, final_total_cents = p_final_total_cents
  where id = (
    select id from public.bills
    where plan_id = p_plan_id
    order by created_at desc
    limit 1
  );
end;
$$;

revoke all on function public.apply_bill_adjustments(uuid, jsonb, integer) from public, anon, authenticated;

create function public.save_bill_with_adjustments(
  p_code text,
  p_host_token text,
  p_service_percent numeric,
  p_gst_percent numeric,
  p_items jsonb,
  p_revision bigint,
  p_adjustments jsonb,
  p_final_total_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare found_plan_id uuid;
begin
  perform public.save_bill_checked(p_code, p_host_token, p_service_percent, p_gst_percent, p_items, p_revision);
  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex');
  perform public.apply_bill_adjustments(found_plan_id, p_adjustments, p_final_total_cents);
  return public.bill_payload(found_plan_id);
end;
$$;

revoke all on function public.save_bill_with_adjustments(text, text, numeric, numeric, jsonb, bigint, jsonb, integer) from public;
grant execute on function public.save_bill_with_adjustments(text, text, numeric, numeric, jsonb, bigint, jsonb, integer) to anon, authenticated;

create function public.start_guest_bill_with_adjustments(
  p_code text,
  p_guest_token text,
  p_service_percent numeric,
  p_gst_percent numeric,
  p_items jsonb,
  p_adjustments jsonb,
  p_final_total_cents integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare found_plan_id uuid;
begin
  perform public.start_guest_bill(p_code, p_guest_token, p_service_percent, p_gst_percent, p_items);
  select plan.id into found_plan_id
  from public.plans plan
  join public.participants participant on participant.plan_id = plan.id
  where plan.code = upper(trim(p_code))
    and participant.guest_token_hash = encode(extensions.digest(p_guest_token, 'sha256'), 'hex');
  perform public.apply_bill_adjustments(found_plan_id, p_adjustments, p_final_total_cents);
  return public.bill_payload(found_plan_id);
end;
$$;

revoke all on function public.start_guest_bill_with_adjustments(text, text, numeric, numeric, jsonb, jsonb, integer) from public;
grant execute on function public.start_guest_bill_with_adjustments(text, text, numeric, numeric, jsonb, jsonb, integer) to anon, authenticated;
