alter table public.bill_items
add column client_id text;

update public.bill_items set client_id = id::text where client_id is null;
alter table public.bill_items alter column client_id set not null;
create unique index bill_items_client_id_per_bill on public.bill_items (bill_id, client_id);

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
          'claimant_ids', coalesce((
            select jsonb_agg(claim.participant_id order by claim.created_at)
            from public.claims claim
            where claim.bill_item_id = item.id
          ), '[]'::jsonb)
        ) order by item.position, item.created_at
      )
      from public.bill_items item
      where item.bill_id = bill.id
    ), '[]'::jsonb)
  )
  from public.bills bill
  where bill.plan_id = p_plan_id
  order by bill.created_at desc
  limit 1;
$$;

create or replace function public.get_bill(p_code text)
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
  where code = upper(trim(p_code)) and expires_at > now() and status <> 'closed';
  if found_plan_id is null then
    raise exception 'This plan is unavailable or has expired';
  end if;
  return coalesce(public.bill_payload(found_plan_id), jsonb_build_object('exists', false));
end;
$$;

create or replace function public.save_bill(
  p_code text,
  p_host_token text,
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
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then
    raise exception 'A bill must contain at most 200 items';
  end if;
  if p_service_percent < 0 or p_gst_percent < 0 then
    raise exception 'Bill rates cannot be negative';
  end if;

  select id into found_plan_id
  from public.plans
  where code = upper(trim(p_code))
    and host_token_hash = encode(extensions.digest(p_host_token, 'sha256'), 'hex')
    and expires_at > now() and status <> 'closed';
  if found_plan_id is null then
    raise exception 'Plan not found or host capability is invalid';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) item
    where coalesce(trim(item->>'id'), '') = ''
      or coalesce(trim(item->>'name'), '') = ''
      or coalesce((item->>'price_cents')::integer, -1) < 0
      or jsonb_typeof(coalesce(item->'claimant_ids', '[]'::jsonb)) <> 'array'
  ) then
    raise exception 'Every bill item needs an id, name, non-negative price, and claimant list';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) item
    cross join lateral jsonb_array_elements_text(coalesce(item->'claimant_ids', '[]'::jsonb)) claimant(participant_id)
    left join public.participants participant
      on participant.plan_id = found_plan_id and participant.id = claimant.participant_id
    where participant.id is null
  ) then
    raise exception 'A claim references someone outside this plan';
  end if;

  select id into found_bill_id
  from public.bills
  where plan_id = found_plan_id
  order by created_at desc
  limit 1;

  if found_bill_id is null then
    insert into public.bills (plan_id, service_percent, gst_percent)
    values (found_plan_id, p_service_percent, p_gst_percent)
    returning id into found_bill_id;
  else
    update public.bills
    set service_percent = p_service_percent, gst_percent = p_gst_percent, status = 'claiming'
    where id = found_bill_id;
    delete from public.bill_items where bill_id = found_bill_id;
  end if;

  insert into public.bill_items (bill_id, client_id, name, price_cents, position)
  select found_bill_id, item->>'id', trim(item->>'name'), (item->>'price_cents')::integer, (item.ordinality - 1)::integer
  from jsonb_array_elements(p_items) with ordinality item(item, ordinality);

  insert into public.claims (bill_item_id, plan_id, participant_id)
  select bill_item.id, found_plan_id, claimant.participant_id
  from jsonb_array_elements(p_items) item
  join public.bill_items bill_item
    on bill_item.bill_id = found_bill_id and bill_item.client_id = item->>'id'
  cross join lateral jsonb_array_elements_text(coalesce(item->'claimant_ids', '[]'::jsonb)) claimant(participant_id)
  on conflict (bill_item_id, participant_id) do nothing;

  update public.bills set updated_at = now() where id = found_bill_id;
  return public.bill_payload(found_plan_id);
end;
$$;

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

  select item.id into found_bill_item_id
  from public.bill_items item
  join public.bills bill on bill.id = item.bill_id
  where bill.plan_id = found_plan_id and bill.status = 'claiming' and item.client_id = p_item_id
  order by bill.created_at desc
  limit 1;
  if found_bill_item_id is null then
    raise exception 'This bill item is unavailable';
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

create trigger bills_broadcast_invalidation
after insert or update or delete on public.bills
for each row execute function public.broadcast_plan_invalidation();

create trigger claims_broadcast_invalidation
after insert or update or delete on public.claims
for each row execute function public.broadcast_plan_invalidation();

revoke execute on function public.bill_payload(uuid) from public, anon, authenticated;
revoke execute on function public.get_bill(text) from public;
revoke execute on function public.save_bill(text, text, numeric, numeric, jsonb) from public;
revoke execute on function public.set_bill_claim(text, text, text, boolean) from public;
grant execute on function public.get_bill(text) to anon, authenticated;
grant execute on function public.save_bill(text, text, numeric, numeric, jsonb) to anon, authenticated;
grant execute on function public.set_bill_claim(text, text, text, boolean) to anon, authenticated;
