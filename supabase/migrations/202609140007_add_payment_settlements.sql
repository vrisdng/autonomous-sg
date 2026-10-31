create table public.payment_settlements (
  plan_id uuid not null references public.plans(id) on delete cascade,
  participant_id text not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'sent', 'received')),
  amount_cents integer not null check (amount_cents >= 0),
  updated_at timestamptz not null default now(),
  primary key (plan_id, participant_id),
  foreign key (plan_id, participant_id) references public.participants(plan_id, id) on delete cascade
);

alter table public.payment_settlements enable row level security;
revoke all on public.payment_settlements from anon, authenticated;

create or replace function public.bill_payload(p_plan_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'exists', true,
    'service_percent', bill.service_percent,
    'gst_percent', bill.gst_percent,
    'status', bill.status,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', item.client_id,
          'name', item.name,
          'price_cents', item.price_cents,
          'claimant_ids', coalesce((select jsonb_agg(claim.participant_id order by claim.created_at) from public.claims claim where claim.bill_item_id = item.id), '[]'::jsonb)
        ) order by item.position, item.created_at
      ) from public.bill_items item where item.bill_id = bill.id
    ), '[]'::jsonb),
    'settlements', coalesce((
      select jsonb_agg(jsonb_build_object(
        'participant_id', settlement.participant_id,
        'status', settlement.status,
        'amount_cents', settlement.amount_cents,
        'updated_at', settlement.updated_at
      ) order by settlement.updated_at)
      from public.payment_settlements settlement where settlement.plan_id = p_plan_id
    ), '[]'::jsonb)
  )
  from public.bills bill
  where bill.plan_id = p_plan_id
  order by bill.created_at desc
  limit 1;
$$;

create or replace function public.set_guest_payment_sent(p_code text, p_guest_token text, p_amount_cents integer, p_sent boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare found_plan_id uuid; found_participant_id text;
begin
  if p_amount_cents < 0 then raise exception 'Payment amount is invalid'; end if;
  select plan.id, participant.id into found_plan_id, found_participant_id
  from public.plans plan join public.participants participant on participant.plan_id = plan.id
  where plan.code = upper(trim(p_code)) and plan.expires_at > now() and plan.status <> 'closed'
    and participant.guest_token_hash = encode(extensions.digest(p_guest_token, 'sha256'), 'hex');
  if found_participant_id is null then raise exception 'Guest capability is invalid for this plan'; end if;
  if not exists (select 1 from public.bills where plan_id = found_plan_id) then raise exception 'The shared bill is unavailable'; end if;
  insert into public.payment_settlements (plan_id, participant_id, status, amount_cents)
  values (found_plan_id, found_participant_id, case when p_sent then 'sent' else 'unpaid' end, p_amount_cents)
  on conflict (plan_id, participant_id) do update set status = excluded.status, amount_cents = excluded.amount_cents, updated_at = now();
  return public.bill_payload(found_plan_id);
end;
$$;

create or replace function public.set_host_payment_status(p_code text, p_host_token text, p_participant_id text, p_amount_cents integer, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare found_plan_id uuid;
begin
  if p_status not in ('unpaid', 'sent', 'received') or p_amount_cents < 0 then raise exception 'Payment status is invalid'; end if;
  select id into found_plan_id from public.plans
  where code = upper(trim(p_code)) and expires_at > now() and status <> 'closed'
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex');
  if found_plan_id is null then raise exception 'Plan not found or host capability is invalid'; end if;
  if not exists (select 1 from public.participants where plan_id = found_plan_id and id = p_participant_id) then raise exception 'Participant is not part of this plan'; end if;
  insert into public.payment_settlements (plan_id, participant_id, status, amount_cents)
  values (found_plan_id, p_participant_id, p_status, p_amount_cents)
  on conflict (plan_id, participant_id) do update set status = excluded.status, amount_cents = excluded.amount_cents, updated_at = now();
  return public.bill_payload(found_plan_id);
end;
$$;

create trigger payment_settlements_broadcast_invalidation
after insert or update or delete on public.payment_settlements
for each row execute function public.broadcast_plan_invalidation();

revoke execute on function public.set_guest_payment_sent(text, text, integer, boolean) from public;
revoke execute on function public.set_host_payment_status(text, text, text, integer, text) from public;
grant execute on function public.set_guest_payment_sent(text, text, integer, boolean) to anon, authenticated;
grant execute on function public.set_host_payment_status(text, text, text, integer, text) to anon, authenticated;
