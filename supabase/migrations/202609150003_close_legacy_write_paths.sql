-- Existing plans/capabilities remain valid. New writes must use the validated
-- outing RPCs; save_guest_outing still invokes its legacy helper as the owner.
revoke execute on function public.create_plan(text,text,jsonb,text) from public,anon,authenticated;
revoke execute on function public.upsert_guest_participant(text,text,text,text) from public,anon,authenticated;

-- Quota rows are server-only; make that explicit in addition to default-deny RLS.
revoke all on public.travel_quota from public,anon,authenticated;
