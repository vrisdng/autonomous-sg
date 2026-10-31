-- Additive: the host confirms the amount actually paid before anyone claims.
-- Existing items, adjustments, and claims stay. Unconfirmed bills leave both columns null.

alter table public.bills
  add column if not exists confirmed_total_cents integer,
  add column if not exists confirmed_at timestamptz,
  add column if not exists total_revised_at timestamptz;

alter table public.bills
  drop constraint if exists bills_confirmed_total_nonnegative;
alter table public.bills
  add constraint bills_confirmed_total_nonnegative check (confirmed_total_cents is null or confirmed_total_cents >= 0);

alter table public.bills
  drop constraint if exists bills_confirmed_total_pair;
alter table public.bills
  add constraint bills_confirmed_total_pair check (
    (confirmed_total_cents is null and confirmed_at is null)
    or (confirmed_total_cents is not null and confirmed_at is not null)
  );

-- Existing rows are claimable without a confirmed total. Only bills inserted
-- after this migration (the default flips to true) wait for the host.
alter table public.bills
  add column if not exists requires_total_confirmation boolean not null default false;
alter table public.bills
  alter column requires_total_confirmation set default true;

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
    ),
    'confirmed_total_cents', (
      select bill.confirmed_total_cents from public.bills bill
      where bill.plan_id = plan.id
      order by bill.created_at desc
      limit 1
    ),
    'confirmed_at', (
      select bill.confirmed_at from public.bills bill
      where bill.plan_id = plan.id
      order by bill.created_at desc
      limit 1
    ),
    'total_revised_at', (
      select bill.total_revised_at from public.bills bill
      where bill.plan_id = plan.id
      order by bill.created_at desc
      limit 1
    ),
    'requires_total_confirmation', (
      select bill.requires_total_confirmation from public.bills bill
      where bill.plan_id = plan.id
      order by bill.created_at desc
      limit 1
    )
  )
  from public.plans plan
  where plan.id = p_plan_id;
$$;

revoke all on function public.bill_payload(uuid) from public, anon, authenticated;

create or replace function public.set_bill_claim(
  p_code text,
  p_guest_token text,
  p_item_id text,
  p_claimed boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
  found_participant_id text;
  found_bill_item_id uuid;
  found_requires boolean;
  found_confirmed integer;
begin
  if char_length(p_guest_token) < 32 then
    raise exception 'Invalid guest capability';
  end if;

  select plan.id, participant.id into found_plan_id, found_participant_id
  from public.plans plan
  join public.participants participant on participant.plan_id = plan.id
  where plan.code = upper(trim(p_code))
    and plan.expires_at > now() and plan.status <> 'closed'
    and participant.guest_token_hash = encode(extensions.digest(p_guest_token, 'sha256'), 'hex');
  if found_participant_id is null then
    raise exception 'Guest capability is invalid for this plan';
  end if;

  select item.id, bill.requires_total_confirmation, bill.confirmed_total_cents
    into found_bill_item_id, found_requires, found_confirmed
  from public.bill_items item
  join public.bills bill on bill.id = item.bill_id
  where bill.plan_id = found_plan_id and bill.status = 'claiming' and item.client_id = p_item_id
  order by bill.created_at desc
  limit 1;
  if found_bill_item_id is null then
    raise exception 'This bill item is unavailable';
  end if;
  if found_requires and found_confirmed is null then
    raise exception 'Waiting for host to confirm the total';
  end if;

  if p_claimed then
    insert into public.claims (bill_item_id, plan_id, participant_id)
    values (found_bill_item_id, found_plan_id, found_participant_id)
    on conflict (bill_item_id, participant_id) do nothing;
  else
    delete from public.claims
    where bill_item_id = found_bill_item_id and plan_id = found_plan_id and participant_id = found_participant_id;
  end if;

  return public.bill_payload(found_plan_id);
end;
$$;

create or replace function public.confirm_bill_total(
  p_code text,
  p_host_token text,
  p_confirmed_total_cents integer,
  p_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
  current_revision bigint;
begin
  if p_confirmed_total_cents is null or p_confirmed_total_cents < 0 then
    raise exception 'Invalid confirmed total';
  end if;
  select id, bill_revision into found_plan_id, current_revision
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex')
    and status = 'planning'
    and expires_at > now()
  for update;
  if found_plan_id is null then
    raise exception 'Host access invalid or plan closed';
  end if;
  if p_revision is distinct from current_revision then
    raise exception 'Bill changed on another device. Refresh before saving; your local edits are retained.';
  end if;
  if not exists (select 1 from public.bills where plan_id = found_plan_id) then
    raise exception 'The shared bill is unavailable';
  end if;
  update public.bills
  set confirmed_total_cents = p_confirmed_total_cents,
      confirmed_at = now(),
      final_total_cents = p_confirmed_total_cents
  where id = (
    select id from public.bills
    where plan_id = found_plan_id
    order by created_at desc
    limit 1
  );
  return public.bill_payload(found_plan_id);
end;
$$;

create or replace function public.reopen_bill_confirmation(
  p_code text,
  p_host_token text,
  p_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_plan_id uuid;
  current_revision bigint;
begin
  select id, bill_revision into found_plan_id, current_revision
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex')
    and status = 'planning'
    and expires_at > now()
  for update;
  if found_plan_id is null then
    raise exception 'Host access invalid or plan closed';
  end if;
  if p_revision is distinct from current_revision then
    raise exception 'Bill changed on another device. Refresh before saving; your local edits are retained.';
  end if;
  update public.bills
  set total_revised_at = case when confirmed_at is not null then now() else total_revised_at end,
      confirmed_total_cents = null,
      confirmed_at = null
  where id = (
    select id from public.bills
    where plan_id = found_plan_id
    order by created_at desc
    limit 1
  );
  return public.bill_payload(found_plan_id);
end;
$$;

revoke all on function public.confirm_bill_total(text, text, integer, bigint) from public;
revoke all on function public.reopen_bill_confirmation(text, text, bigint) from public;
grant execute on function public.confirm_bill_total(text, text, integer, bigint) to anon, authenticated;
grant execute on function public.reopen_bill_confirmation(text, text, bigint) to anon, authenticated;
