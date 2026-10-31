# Real outing verification — 2026-09-15

## Verified against OneMap

- Token-authenticated Search returned real building/station coordinates for western, central, and eastern Singapore queries, including Clementi MRT, Dhoby Ghaut MRT, Tampines-area searches, and all 12 catalogue addresses.
- A Clementi → Dhoby Ghaut driving request returned 982 seconds and 12,578 metres. This is one checked response, not a constant stored in the application.
- A fresh 390×844 headless Edge session created two people with searched locations, chose a venue, fetched actual driving legs, matched a pair, and split an entered $10.01 fare. It then opened a new empty food bill and allocated an entered item.
- Transit requests for 2026-09-15 returned walking-only itineraries; a rail-specific request returned an error. The production parser rejects walking-only fallback. Last Call correctly displays no group deadline in this case. **A successful scheduled transit itinerary has not been live-verified.**

## Verified locally

- Ten migrations applied successfully to PGlite PostgreSQL with pgcrypto. Only Supabase's Realtime transport was stubbed.
- A host created a one-person plan; a guest joined; a stale host update was rejected without deleting the guest.
- Food claims persisted; stale bill saves were rejected; a guest could not confirm payment as host; direct anonymous table reads were denied; closed-plan claim changes were rejected.
- Unit tests cover midnight conversion, invalid dates, partial-route group deadlines, walking-only fallback, complete-only ranking, both driving orders, and exact entered-fare splitting.
- Automated mobile layout checks reported no horizontal overflow and no browser page errors.

## Still required for release

- Extended two-client tests for automatic Realtime/polling, payment UI, offline recovery, and conflicts.
- Reliable transit results for west, central, and east examples. Do not mark Last Call live-complete based on an HTTP success or a walking itinerary.

## Verified against deployed Supabase

- Project `jagzkkcpfeknpqprftzj`: all ten migrations applied. The last migration revokes obsolete creation/join RPCs that bypass current location and group-size validation; existing records and guest capabilities are preserved.
- Live PostgreSQL assertions ran as `anon`: create/join, stale plan/bill rejection, claims, sent/received permissions, direct table denial, and closed-plan checks passed. Transactional test data was rolled back.
- `node --env-file=.env.local scripts/verify-live-database.mjs` passed against the public REST API and removed only its own temporary plan afterward.
- OneMap Edge Function version 1 deployed with project-key validation and database-backed quotas. Missing/invalid keys return 401. Server-side OneMap credentials now return real search and driving results through the deployed function; no credentials are in the client bundle.
- `node scripts/verify-sharing.mjs` passed using two independent 390×844 Edge contexts at the local preview against deployed Supabase/OneMap: create/join, selected venue, explicit refresh, shared bill, guest claim, and reload retaining the correct guest role. Earlier failed runs revealed and led to fixing editable bill controls appearing before initial loading finished.
- `node scripts/verify-preview.mjs` passed with the deployed OneMap adapter. Scheduled transit remains unverified: unavailable results produce no reassuring countdown.
- Security advisor flags default-deny RLS tables and intentionally anonymous SECURITY DEFINER RPCs. The capability-checking RPCs are the guest API; table access stays denied. These warnings require review, not blanket grants: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable

## Public Cloudflare pilot

- Live URL: https://bojio.pages.dev (Pages project `bojio`, production branch `main`, Direct Upload).
- Deployment `d1a65a69`: public root and `/plan/:code` return the application. Two independent phone browser contexts passed live address search, create/join, copied invitation origin/code, direct path invitation, venue selection, food bill sharing/claiming, and guest role preservation on reload.
- Initial deployment revealed Metro's stale environment cache. The production build now clears that cache and checks the emitted bundle for the required public Supabase configuration and SPA redirect before deployment.
- Publish updates with `npm run deploy:web` after testing. This rebuilds and uploads `dist` with pinned Wrangler 4.131.2. Pushing Git alone does not publish this Direct Upload project. Keep public Supabase settings in local/CI build environment; private OneMap credentials stay in Supabase secrets.
- Extended offline/conflict/payment-UI acceptance and successful transit journeys remain open release checks above. This is a working free-tier pilot, not a guarantee of uninterrupted availability.

The earlier separate local test-preview launch was blocked by automatic approval review. Current tests use the normal preview or the public URL with the real cloud backend; they do not bypass that restriction.

No OneMap token or private credentials are stored in Git. The existing Google provider files remain for legacy compatibility and are not used by the normal app flow.

## Venue discovery and latency update — 2026-09-15

- Cloudflare production deployment `98f9d0b8`, OneMap function version 5, migration `weighted_travel_budget`.
- Added name/postcode search within the shortlist, cuisine/area filters, varied initial cuisine order, expandable venue headings, and branch-specific Google Maps review/photo links. No new ratings, restaurant facts, or live-hours claims were invented. The shortlist remains 12 venues; filters are not live restaurant discovery.
- Two concurrent routes per batch; global/client weighted quotas reserve worst-case retry/auth work. Client batches remain sequential to bound load. Matching still considers all directed pairs, so large groups still require many journeys.
- In-flight lookup deduplication only, no persistent location/route cache. Address requests abort when edited/unmounted; Enter submits search. Meet emits partial batch results; rides report checked/total journeys without claiming a final pairing prematurely.
- 50 unit tests, typecheck, all eleven local migrations, weighted-budget permission/limit tests, handler authentication/validation/concurrency tests, and the clean production build passed.
- Public mobile test passed real address search, postcode/cuisine/area filters, expanding/collapsing a venue, opening its actual Maps URL, selection, real driving comparison, entered fare, food allocation, no horizontal overflow, and no browser page errors.
- Two independent public phone sessions also passed create/join, invitation opening, shared venue/bill claims, explicit refresh, and guest role preservation on reload. The live REST permission/conflict/closed-plan suite passed and deleted only its own temporary verification plan.
- A live search after deployment returned HTTP 200 with 5 Clementi matches in 2165 ms; Edge region was already `ap-southeast-1`. This is one end-to-end sample, not evidence of a search latency improvement. Backend authentication validation was retained; no region override was needed. Successful scheduled transit and extended offline tests remain outstanding as above.

## Progressive Last Call — 2026-09-15

- Published to Cloudflare production deployment `0555f2dd` at https://bojio.pages.dev.
- Last Call no longer gates the whole screen behind a complete Meet plan. Standalone quick journeys accept departure/return locations and persist separately on the device without creating or replacing a group plan.
- Meet shows venues even before all people are ready. Guidance distinguishes the automatic local draft from optional shared-plan publication; sharing controls follow venue selection.
- Last Call displays partial group members and missing inputs, requests schedules only for valid destinations, and automatically rechecks after relevant edits settle (900 ms). Local draft subscriptions and web storage events propagate changes immediately; remote saved changes retain the 15-second refresh.
- Requests are cancelled on changed inputs/unmount; old results are keyed to their input identity and cannot generate a countdown for new inputs. No route timer polling. Every public-transport member still needs a future route before a group countdown is available.
- “Now” is evaluated when the request is made, not when setup began; explicitly selected times remain fixed. An initial public test exposed this minute-boundary bug and prompted the fix.
- 53 unit tests and typecheck pass. `scripts/verify-last-call.mjs` uses explicit test-only schedule fixtures to exercise standalone use, refresh, cross-tab incomplete-to-complete updates and partial countdown suppression. Fixtures are never in the production bundle and do not establish live transit availability. Separate real-provider/public sharing regression tests also pass.
- Final deployed fixture test advances the browser clock two minutes during setup and verifies that the request still uses current time. Storage-event updates read the local draft without republishing it, preventing tabs from triggering a remote refresh loop.

## Venue selection feedback — 2026-09-15

- Production deployment `b308f8e5`: selecting a OneMap address now chooses the venue immediately and clears shortlist filters that could hide the new entry. Previously it only added a candidate and required a second selection.
- Selection confirmation is displayed; disabled selection controls explain guest, closed-plan and busy states without bypassing host permissions.
- Public `verify-venue-selection.mjs` passed empty-draft restaurant selection, address selection through active filters, reload persistence, and guest/closed restrictions (address/role fixtures only). Real-provider mobile regression, 53 unit tests, typecheck, and production build passed. The user's exact original browser state was not available; these fix identified selection-flow issues rather than asserting their session's cause.

## Existing-function reliability — 2026-09-15

- Published to production deployment `8e5fd79a` at https://bojio.pages.dev (supersedes `b57c5414` with the payment/refresh race fix).
- Ordered bill persistence and reads behind pending writes. A failed initial disk load keeps editing/autosave disabled and offers Retry, rather than overwriting stored data with an empty bill.
- Failed guest claims leave the confirmed bill untouched and do not leave a dirty host-style draft that blocks background refresh. Reopening a guest bill uses server claims even when an old cached dirty flag exists.
- Bill clearing preserves participants, revision and pending-sync state; saved recovery drafts are restored after reopening. Bill refresh locks host item editing while fetching. Clipboard/share failures are surfaced.
- Connected bills retain their plan identity even when the participant list is empty, instead of inadvertently saving into the standalone bill slot.
- 55 unit tests, typecheck and eleven-migration database suite passed. Dedicated browser storage fixtures passed read failure/retry, preserved original data, and clearing without losing the revision.
- Expanded two-independent-session live test on preview `5172867f` passed failed offline guest claim/retry, guest manual sent status, host receipt confirmation, guest inability to confirm receipt, host edits surviving offline navigation/reconnect, and amount changes invalidating old receipt status. This verifies these scenarios, not every possible offline conflict or an offline-installable app.
- Last Call standalone and partial-plan regression passed with explicitly mocked schedules. Successful live transit remains unverified; unavailable results still must not be treated as confirmed last services.
- A repeated production run caught a payment tap being silently ignored during a concurrent bill refresh. Payment buttons now disable across refresh/payment operations, and a mutation version prevents older background responses from overwriting a newer claim/payment result. The live test deliberately delays a bill refresh and checks this disabled state.

## Restoration and route lifecycle — 2026-09-15

- Production web deployment `40b21300`; OneMap function version 6.
- Transit parser compares start times at the provider's documented whole-second precision. A sub-second client timestamp no longer rejects a same-second itinerary. Invalid requested dates and internally inconsistent/out-of-bounds leg timestamps are rejected.
- Checked official routing documentation's published JS sample: `routeType=pt`, `mode=TRANSIT`, `date=MM-DD-YYYY`, `time=HH:mm:ss` match our request format (https://www.onemap.gov.sg/apidocs/routing).
- Live west/central/east transit checks at approximately 17:31 SGT returned timeout results after 24.4 seconds. The parser fix does not establish live transit availability or solve provider timeouts; successful live transit remains an open release check.
- Saved custom venues reappear in the shortlist as selected after reopening. Returning guests see their existing name, location and transport preference without re-entering them.
- Meet and shared-ride requests now abort on changed inputs/unmount; cancellation prevents subsequent batches. Unit tests verify no second batch is sent after cancellation. Already-started provider work may still complete server-side.
- 59 unit tests, typecheck, handler tests and production build passed. The live driving regression now requires all four actual durations for a two-person comparison, rather than merely checking that the UI finished a request.
- Deployed browser checks passed custom venue restoration, guest form restoration, offline claim/reconnect/payment flow, and all four real driving durations. Last Call still returned unavailable rather than an invented deadline.
