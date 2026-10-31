import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';

// Run with node --env-file=.env.local scripts/verify-live-database.mjs.
// Uses the public API exactly as a guest would. Only its own temporary plan is deleted.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key, 'Configure public Supabase settings first');
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('');
const host = randomBytes(32).toString('hex'), guest = randomBytes(32).toString('hex');
const location = { label: 'Clementi MRT', latitude: 1.315116, longitude: 103.765191 };
const people = [{ id: 'host', name: 'Verification host', origin: location.label, location, transportMode: 'either' }];
async function rpc(name, args) {
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify(args), signal: AbortSignal.timeout(15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
  return data;
}
const planArgs = { p_code: code, p_host_token: host, p_participants: people, p_venue: null,
  p_meetup_at: new Date().toISOString(), p_commute_at: new Date().toISOString(), p_revision: null };
let created = false;
try {
  const plan = await rpc('save_outing', planArgs);
  created = true;
  assert.equal(plan.participants.length, 1);
  const joined = await rpc('save_guest_outing', { p_code: code, p_guest_token: guest,
    p_name: 'Verification guest', p_location: location, p_mode: 'train' });
  assert.equal(joined.participants.length, 2);
  await assert.rejects(rpc('save_outing', { ...planArgs, p_revision: plan.revision }), /changed on another device/);
  const updated = await rpc('set_guest_transport_mode', { p_code: code, p_guest_token: guest, p_transport_mode: 'ride' });
  assert.equal(updated.participants.find(p => p.id === joined.participant_id).transportMode, 'ride');
  const billArgs = { p_code: code, p_host_token: host, p_service_percent: 0, p_gst_percent: 0,
    p_items: [{ id: 'supper', name: 'Verification supper', price_cents: 1001, claimant_ids: ['host'] }], p_revision: 0 };
  const bill = await rpc('save_bill_checked', billArgs);
  await assert.rejects(rpc('set_bill_claim', { p_code: code, p_guest_token: guest, p_item_id: 'supper', p_claimed: true }), /confirm the total/);
  const confirmed = await rpc('confirm_bill_total', { p_code: code, p_host_token: host, p_confirmed_total_cents: 1001, p_revision: bill.revision });
  assert.equal(confirmed.confirmed_total_cents, 1001);
  const claimed = await rpc('set_bill_claim', { p_code: code, p_guest_token: guest, p_item_id: 'supper', p_claimed: true });
  assert.equal(claimed.items[0].claimant_ids.length, 2);
  assert.equal(claimed.items[0].price_cents, 1001);
  await assert.rejects(rpc('save_bill_checked', { ...billArgs, p_revision: bill.revision }), /changed on another device/);
  await rpc('set_guest_payment_sent', { p_code: code, p_guest_token: guest, p_amount_cents: 501, p_sent: true });
  const payment = { p_code: code, p_host_token: guest, p_participant_id: joined.participant_id, p_amount_cents: 501, p_status: 'received' };
  await assert.rejects(rpc('set_host_payment_status', payment), /invalid/);
  await rpc('set_host_payment_status', { ...payment, p_host_token: host });
  const reloaded = await rpc('get_bill', { p_code: code });
  assert.equal(reloaded.settlements[0].status, 'received');
  const table = await fetch(`${url}/rest/v1/plans?select=id`, { headers: { apikey: key } });
  assert.ok([401, 403].includes(table.status), 'Anonymous direct table read must be denied');
  await assert.rejects(rpc('upsert_guest_participant', { p_code: code, p_guest_token: guest, p_display_name: 'Old client', p_origin: 'Clementi' }), /permission denied/);
  await rpc('set_plan_status', { p_code: code, p_host_token: host, p_status: 'closed' });
  await assert.rejects(rpc('set_bill_claim', { p_code: code, p_guest_token: guest, p_item_id: 'supper', p_claimed: false }), /invalid/);
  console.log('PASS: live public API host/guest, transport, conflicts, bill claims, manual receipt permissions, reload, RLS and closed plans.');
} finally {
  if (created) {
    await rpc('delete_plan', { p_code: code, p_host_token: host });
    console.log('Removed this run’s temporary verification plan; no user plans were changed.');
  }
}
