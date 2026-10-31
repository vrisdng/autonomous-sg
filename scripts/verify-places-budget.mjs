import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const db = new PGlite();
try {
  await db.exec('create role anon; create role authenticated; create role service_role;');
  await db.exec(await readFile('supabase/migrations/202609160002_places_budget.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/202609160004_places_details_budget.sql', 'utf8'));
  await db.exec(await readFile('supabase/migrations/202609160006_places_media_budget.sql', 'utf8'));
  const consume = async bucket => (await db.query('select public.consume_places_budget($1) as allowed', [bucket])).rows[0].allowed;
  await db.exec('set role anon');
  await assert.rejects(consume('a'.repeat(64)), /permission denied/);
  await assert.rejects(db.query('select * from public.places_request_budget'), /permission denied/);
  await db.exec('set role service_role');
  assert.equal(await consume('invalid'), false);
  for (let i = 0; i < 10; i++) assert.equal(await consume('a'.repeat(64)), true);
  assert.equal(await consume('a'.repeat(64)), false);
  await db.exec('reset role');
  assert.equal((await db.query("select requests from public.places_request_budget where bucket='nearby-enterprise'")).rows[0].requests, 10);
  await db.exec("update public.places_request_budget set requests=899 where bucket='nearby-enterprise'");
  assert.equal(await consume('b'.repeat(64)), true);
  assert.equal(await consume('c'.repeat(64)), false);
  assert.equal((await db.query("select requests from public.places_request_budget where bucket='nearby-enterprise'")).rows[0].requests, 900);
  await db.exec("update public.places_request_budget set window_start=now()-interval '40 days' where bucket='nearby-enterprise'");
  assert.equal(await consume('c'.repeat(64)), true);
  assert.equal((await db.query("select requests from public.places_request_budget where bucket='nearby-enterprise'")).rows[0].requests, 1);
  console.log('Places budget: permissions, client cap, global cap, denied-request accounting and billing-month rollover passed.');
  const details=async()=> (await db.query("select public.consume_places_budget($1,'details-enterprise') as allowed",['d'.repeat(64)])).rows[0].allowed;
  await db.exec('set role anon');await assert.rejects(details(),/permission denied/);
  await db.exec('set role service_role');
  for(let i=0;i<60;i++)assert.equal(await details(),true);
  assert.equal(await details(),false);
  await db.exec('reset role');
  await db.exec("update public.places_request_budget set requests=900 where bucket='details-enterprise'");
  assert.equal((await db.query("select public.consume_places_budget($1,'details-enterprise') as allowed",['e'.repeat(64)])).rows[0].allowed,false);
  assert.equal((await db.query("select public.consume_places_budget($1,'nearby-enterprise') as allowed",['e'.repeat(64)])).rows[0].allowed,true);
  console.log('Details budget: independent SKU, permissions, 60/hour and 900/month caps passed.');
  for(const [sku,limit] of [['photos',60],['reviews',30]]){
    for(let i=0;i<limit;i++)assert.equal((await db.query('select public.consume_places_budget($1,$2) as allowed',['f'.repeat(64),sku])).rows[0].allowed,true);
    assert.equal((await db.query('select public.consume_places_budget($1,$2) as allowed',['f'.repeat(64),sku])).rows[0].allowed,false);
    await db.query('update public.places_request_budget set requests=900 where bucket=$1',[sku]);
    assert.equal((await db.query('select public.consume_places_budget($1,$2) as allowed',['a'.repeat(64),sku])).rows[0].allowed,false);
  }
  console.log('Photos/reviews: independent 900/month budgets and 60/30 connection limits passed.');
  await db.exec(await readFile('supabase/migrations/202609160009_remove_places_monthly_caps.sql', 'utf8'));
  for(const [sku,limit] of [['nearby-enterprise',10],['details-enterprise',60],['photos',60],['reviews',30]]) {
    await db.query('update public.places_request_budget set requests=10000 where bucket=$1',[sku]);
    const call=async()=> (await db.query('select public.consume_places_budget($1,$2) as allowed',['9'.repeat(64),sku])).rows[0].allowed;
    for(let i=0;i<limit;i++)assert.equal(await call(),true,'monthly usage no longer blocks');
    assert.equal(await call(),false,'hourly enforcement retained');
    assert.equal((await db.query('select requests from public.places_request_budget where bucket=$1',[sku])).rows[0].requests,10000+limit,'monthly metering preserved');
  }
  await db.exec('set role anon');await assert.rejects(consume('8'.repeat(64)),/permission denied/);
  console.log('CURRENT POLICY PASS: no monthly caps for all four SKUs; monthly counters, hourly caps and permissions preserved.');
  await db.exec('reset role');
  await db.exec(await readFile('supabase/migrations/202609160010_remove_places_hourly_caps.sql','utf8'));
  for(const sku of ['nearby-enterprise','details-enterprise','photos','reviews']) {
    const before=(await db.query('select requests from public.places_request_budget where bucket=$1',[sku])).rows[0].requests;
    assert.equal((await db.query('select public.consume_places_budget($1,$2) as allowed',['9'.repeat(64),sku])).rows[0].allowed,true,'previously exhausted hourly bucket now succeeds');
    assert.equal((await db.query('select requests from public.places_request_budget where bucket=$1',[sku])).rows[0].requests,before+1,'metering retained');
  }
  assert.equal(await consume('invalid'),false);
  await db.exec('set role anon');await assert.rejects(consume('8'.repeat(64)),/permission denied/);
  console.log('LATEST POLICY PASS: hourly and monthly caps removed; metering, validation and permissions retained.');
} finally { await db.close(); }
