# Bojio — PC handoff

## Search-area picker closes on current location — 2 October 2026

“Where shall we search?” now puts Use my current location and the OneMap type field side by side, both in the same lime block treatment. A successful GPS fix still only sets the restaurant search area (participant home / return destination unchanged), then runs the existing nearby search and closes the sheet. Denied, unavailable, and outside-Singapore results keep the sheet open. Typed OneMap results still wait for Find food nearby. Meet in the middle still uses the geographic average and the same two-location gate, in the same lime treatment as the other search actions.

## At-a-glance entry and home — 1 October 2026

Party entry now pairs a compact greeting with a code-native Bao mascot; Create and Join sit side by side, and the invite field appears on Join. Existing invitation/name/host flows retained. Bao enters once, greets on tap and tilts on horizontal drag; vertical scroll is not claimed, reduced motion disables transforms, timers/animations clean up. Home greeting and party metadata are smaller, with a two-column Meet/Split/Ride/Last Call action grid. No backend or provider changes. Typecheck, web export/config check and focused mocked 390px browser smoke passed (mascot tap, create/back, join disclosure, Home grid, overflow); screenshots inspected. Actual touch-device drag remains a manual check.

## Subtle interface motion — 1 October 2026

Tab content enters with a 7px/180ms fade-slide; selected navigation icons pop once over 230ms on selection changes; shared buttons compress 2% on press with a 100ms web transition. No idle loops or artificial navigation delays. useReducedMotion observes browser/native accessibility preferences and disables these added transforms/transitions; cleanup stops interrupted animations. Existing restaurant swipe gestures are unchanged. Typecheck/export and focused browser smoke cover rapid tab changes, Back and immediate content under reduced motion; provider requests mocked.

## Remembered home + calmer app layout — 1 October 2026

HomeLocationEditor remembers confirmed home addresses by normalized display name in this browser (savedHome.ts), reuses the same preference across parties, displays the address with Change, and offers Use saved home for this party before publishing it into a new party. Existing participant addresses migrate locally once, except generic Current location GPS labels. Forget writes a tombstone so existing party data does not repopulate the personal preference on remount. No IP tracking or account identity: matching names on the same browser share a preference; another browser must enter it again. Pending save/retry, server capability/closed-plan guards remain. Privacy page explains retention and forget scope.

Meet's compact search-area row expands GPS/address/midpoint controls. Search-area editing no longer changes participant.location/home; midpoint and existing travel comparisons still use the party's saved participant locations. New party/empty deck keeps clear neighbourhood and home prompts. Home input collapses after save, shows Change, and lives below swipe content/journeys. Last Call and ride use the same address editor. Warm neutral/deep green/chilli palette, lime selected navigation, aligned app shell, less outlined cards, clear row separators, playful home/party entry, and focused empty receipt scan state. No new tabs.

Critical checks: saved-home isolation/forget/invalid-location tests, typecheck, production export, and verify-saved-home-design.mjs at 390px (cross-party reuse requires a tap, edit, forget, refresh, screenshots of screens; backend/provider fixtures only). Existing verify-location-sync.mjs remains live Supabase integration coverage. No paid provider calls needed for visual checks. supabase/.temp is unrelated untracked local state; do not commit.

## Shared home locations and creation recovery — 20 September 2026

Fixed the shared-store pendingSync gate: remote participant updates now merge into pending local drafts. Last-confirmed participant snapshots allow field-level merging without discarding local edits; new members and closed status propagate. The original draft revision remains unchanged deliberately: conflicting host publishes still require the existing refresh/recovery workflow, rather than silently overwriting remote edits. Old drafts without a baseline take other participants' remote details while retaining the host's own entry. Poll interval remains 15 seconds; rides offer Check friends’ updates when locations are missing.

Added Your home address in Meet, Share ride and Last Call. Uses existing participant.location (no migration); starting location still initially doubles as the return destination. Last Call Just me uses the member's shared home; genuinely standalone destinations are labelled device-only. Home edits save through existing permission-checked RPCs; failed addresses survive refresh under a party/participant-specific pending-home key and offer retry. Successful-save polling races are recognized without falsely reporting failure. Concurrent local changes/party switching retain the pending input instead of overwriting newer edits. Meet inline location confirmation now waits for the save and offers retry; failed addresses are retained for the shared home editor on reopening.

RPC requests use an AbortController with a 15-second timer and friendly timeout/network messages. No automatic write retries. Party creation retains its existing idempotency capability and recovers an unconfirmed creation after refresh; retry reuses the same party code/token rather than creating another party.

Critical verification: five merge/store tests, TypeScript, Expo web production export/config check; scripts/verify-location-sync.mjs tests two independent browsers against live Supabase, failed home-save refresh/retry, host pending edits with newly available ride matching, closed plans, plus mocked failed creation and same-code/token recovery. Restaurant/location providers are mocked to avoid paid calls; temporary database test party is deleted. No production database/schema changes. Physical iOS suspension/network timeout behaviour remains device-verifiable.

## Honest swipe startup + browser tab history — 18 September 2026

SwipeDeck no longer shows Loading saved swipes or fabricated medal placeholders. Before the shortlist loads, the inline location controls remain usable; preparing copy only appears when actual search candidates exist. Empty host state points to the neighbourhood picker above. Top 3 renders actual liked entries only (one like => one card); a loaded deck without favourites retains an unobtrusive group-ratings/review entry. Existing fetching/error/retry and voting guards unchanged.

All bottom tabs and screen go callbacks now push hash routes (#home/#meet/#split/#ride/#train), with duplicate-tab suppression, popstate Back/Forward handling and scroll-to-top. Party entry replaces its invite URL with #meet. History state contains only an opaque scope (no capability); navigating into a previous party context opens the chooser rather than applying old navigation to the current party. Startup chooser policy retained. Nested modal steps are not browser-history routes yet.

Critical script verify-empty-and-history.mjs delays mocked swipe state, asserts no phantom cards/text, checks a real fixture ranking and Back/Forward sequence. Typecheck/export/config pass; no paid provider calls or database changes.

## Party swipe dots follow card — 18 September 2026

Moved the reveal/hide dots button inside the card's Animated.View with a fixed inset. It now shares the exact drag and snap transform instead of jumping between fixed positions when open changes. Focused gesture test asserts matching card/dots displacement before release; existing delete/undo checks, typecheck and build pass. No data/API changes.

## Swipe-remove party history — 18 September 2026

Party chooser history rows swipe left to reveal a red Delete / From this list action. Horizontal intent threshold and vertical-axis lock preserve scrolling; right swipe closes, and a labelled dots button exposes the same action for keyboard/non-swipe users. Only one row is revealed. Undo restores the last removed entry. Per-code local hidden markers keep rows (including the last-opened summary) out of the list after refresh and routine saves; entering through an invitation explicitly restores visibility. No shared-party deletion: capabilities, drafts, bills and pending edits are deliberately retained. No remote writes or database migration.

Critical checks: four party-history storage tests, typecheck/export/config and focused 360px browser gesture/undo/reload/capability-retention check. scripts/verify-party-swipe.mjs blocks backend requests and uses local fixtures. Physical phone swipe remains user-verifiable.

## Inline Meet location and midpoint — 18 September 2026

Meet now exposes browser geolocation and compact typed OneMap picker directly above cards, replacing the preset-city/hidden-area setup. Permission is requested only on Use my current location. Denied/unavailable/outside-Singapore results leave typed entry available; late GPS callbacks are ignored after choosing another location or leaving. Own participant is identified by retained participantId (single-person local/legacy host fallback only); missing identity uses search area only, never assigns another person's location. GPS/typed starting points save through existing guest/host RPCs and revision checks; UI notes party sharing and initial return-destination reuse. Host profile updates preserve local pending edits on failure.

Find food nearby uses the chosen coordinates. Meet in the middle appears for groups, enabled with at least two confirmed locations and showing contributing/total count. Geographic average only, explicitly not fastest/fair-travel optimization. Guests can update their own location but only host replaces the shared restaurant deck. Additional criteria remain under top-right dots. Existing auto-search-once and no-polling restaurant-fetch behavior retained.

Critical test scripts/verify-meet-location.mjs uses fixture browser geolocation and mocked providers to verify own-location storage, nearby and exact midpoint coordinates, denial fallback and phone width; no paid provider calls or real-GPS accuracy claims. Typecheck/export/config passed. No database migration.

## Party chooser and separate outings — 18 September 2026

Startup now opens a chooser rather than silently restoring the current outing. Known invitation links ask Continue or start fresh (host and returning guest), without asking for the name again. All locally remembered parties appear below with code, host/guest role, names and Singapore meetup date. Guests may create their own hosted party and return to guest roles in other parties. Invitation/code entry and name selection remain available. Share controls are tucked behind Invite friends except immediately after creation.

Create new always allocates a fresh code and empty participant/venue/bill state; it no longer repurposes unpublished local drafts. Per-party serialized drafts preserve pending edits across switches; existing access-key records are discovered for pre-upgrade history. Lists are device/browser-local, not global accounts. Google display details still pass through serializePlan ID-only filtering. No database migration or new provider calls. Closed known parties may be viewed; server write restrictions remain unchanged.

Critical checks: five storage/recovery unit checks, typecheck/export/config, real Supabase two-session browser flow covering multiple host/guest parties, fresh bill, switching/refresh and guest creating a host party. Browser check now waits for the entire dialog to close, not the close button (which is hidden during requests). Provider endpoints blocked in test, no paid calls. Test-created parties deleted after checks.

## Party invitations + Gojek copy handoff — 18 September 2026

Global Party · Invite button plus Home create/join entry. PartyAccess gates incoming /plan/CODE and ?plan=CODE links before mounting the outing. Host creates with a name only, then shares/copies link or code; locations can be added later. Invite shows roster and name input. Existing browser capabilities restore automatically, independent of IP. Another browser can deliberately choose an existing name without approval (explicit user decision); shared guest-only capability preserves participant ID, claims and votes. Host token is never returned or put in URLs. Selecting the host's name elsewhere grants only a guest role, not host access. Privacy and creation copy disclose the open-name trust model. Clear/private browser data requires selecting a name again.

Migration 202609180001_party_invites.sql deployed: optional participant locations, idempotent initial host-create recovery, join_party RPC and private participants.party_join_token column (direct anon/auth access denied; public payload excludes it). Stable guest capability is shared only through explicit name join. Existing legacy guest token is retained if its original browser joins first; if another device claims a legacy name first, older open tabs may need to reopen the invitation to restore the canonical capability. Plan row locking, 12-person cap, duplicate-name guidance, closed/expired checks and host revision protections retained. Guest token/host capability writes precede uncertain create/join operations; failed storage blocks entry. Pending outgoing draft retained in recovery; same-party pending edits retained on reopening.

Gojek panel supports copy each pickup/drop-off plus Copy pickup & open Gojek. No claim of Gojek automatic destination filling; intermediate stops remain manual and nothing books/pays. Grab behavior unchanged.

Critical checks only: targeted PGlite party/permission tests; actual Supabase via three independent 360px browser sessions on local build and public site (name-first create/join, code entry, direct /plan links, remembered identity, cross-device selection, transport update and closed-party rejection); typecheck/export/config; mocked clipboard/app-launch Gojek test. No paid provider calls; test-created parties removed using their host capabilities. Actual Gojek app launch/paste still requires a physical phone check. Supabase OAuth now includes projects:read,database:read,database:write,edge_functions:read,edge_functions:write. Use these explicit scopes if reconnecting; default scopes previously failed.

## User-focused Share ride — 17 September 2026

OneMap driving retained per user. Removed verbose matrix/progress/dev explanations, initial per-person Maps clutter and duplicate directions/food-bill actions. Cards lead with riders, estimated duration, visible numbered drop-offs, side-by-side ride-app buttons, Maps, and exact entered-fare shares. Grab reminder retains manual intermediate-stop instruction; Gojek tells users to copy stops. Red close cross for handoff panel. Failed fare loading/saving now has separate error state rather than routine retry controls during loading or route messages hiding save errors. Device-only fare note, estimate attribution and matching limits retained concisely. No routing/link behavior changes. Typecheck/build/config and focused 360px handoff/order/24.01-cent reconciliation check pass; screenshot inspected. No paid API calls.

## Prominent group countdown — 17 September 2026

Together leave-by is now a red bordered banner with bold deadline and large HH:MM:SS countdown. Its isolated component ticks every second using absolute time, without rerendering route requests or adding provider polling. Existing complete/validated group gate retained; expired banner disappears, no negative/reassuring timer. Targeted formatter and mocked phone ticking/no-route-refetch checks only, plus typecheck/build.

## Hour-format countdown — 17 September 2026

Time to zao compact cards now show hours/minutes from 60 minutes (1h, 1h 15m, 2h); under an hour remains minutes. Timer eligibility and rounding unchanged. Focused boundary test and typecheck/build pass; no provider calls needed.

## Google transit + experimental ride handoff — 17 September 2026

User approved Google Routes and phone-link experiments. google-transit v2 deployed with server-only Routes/Maps/Places key lookup, project-key auth, existing atomic travel budget, max four trips/two concurrent provider calls, 12-second provider timeout, no billable automatic retries. Frontend uses Google first for transit and OneMap on failures; temporary session circuit-breaker avoids repeated Google auth/quota failures. Search/driving stay OneMap. Google results kept in memory; attribution and privacy updated. Scheduled connected itinerary parsing includes walking and midnight, never independent last-service stitching. No guarantee of absolute last journey or faster latency.

LTA v12 matches Google bus coordinates conservatively (within 60m, rejects nearby competing stops), then verifies service/direction with published BusRoutes. Upcoming bus estimates require matching origin/destination/visit, vehicle-based timing within five minutes of scheduled boarding; transfer-risk compares delay plus walking and three-minute buffer. Unmatched and outside-live-window cases are explicit, not verified. Incomplete last-service checks and stale checks pause countdowns. Google route successes: central 11350ms (initial), west 1220ms, east 1091ms end-to-end. LTA checks west 6863ms/east 5803ms. Eastern example matched train/bus limits plus live bus; western bus stop remained unverified. Three Google calls total during verification. scripts/verify-google-transit-live.mjs makes potentially billable calls; manual only.

Ride group cards offer experimental Grab pickup/final destination deep link, Gojek app-opening link (NO verified autofill), copy ordered stops and complete Google Maps driving route. Warning explicitly requires manual intermediate stops before booking; nothing books or pays automatically. Desktop 360px test intercepts app launch and verifies params/stop order; PHYSICAL PHONE app opening/autofill still needs user verification. No invented Gojek destination params. Existing four-passenger matching left unchanged.

Targeted parser/stop/link/schedule tests (9), typecheck, production build/config and mocked phone cards/handoff passed locally. Public smoke check recorded at release. Supabase OAuth recovered via `codex mcp login supabase --scopes projects:read,edge_functions:read,edge_functions:write`; default registration fails with invalid scopes. Current login is intentionally limited to functions/project read, not database changes. No credentials stored in source.

## Compact Last Call cards — 17 September 2026

Each latest journey now starts as a compact tappable person strip: name, home, leave-by, prominent minutes countdown; no fabricated timer when missing/expired/conflicting. One expanded person at a time, with walk/bus/train icon timeline, times, arrival and Maps. Last-service details are a nested disclosure. IMPORTANT LastServices stays mounted while visually hidden (visible prop), so official checks and disruption callbacks still run before any countdown. Expansion does not refetch routes. Group/Just me segmented selector replaces scattered buttons; compact departure card and get-ready settings below timers. Quick location form collapses once both locations are known.

Typecheck/build/config and mocked 360px check (collapsed timer, background validation, timeline/Maps, collapse, no expansion refetch, width) passed; screenshots inspected. scripts/verify-lastcall-cards.mjs is synthetic transport, not latency or live last-service verification. No provider switch: researched Google Routes transit as an alternative, Essentials 10k monthly free / USD5 per 1k next tier; speed unbenchmarked and last-service search still needs several calls. User approval/API enablement required before switching paid service.

## Receipt charges, host payment and concise Last Call — 17 September 2026

receipt-ai v9 returns validated printed GST/service rates, amounts and included/additional/unknown flags. Empty bill scan review prefills explicitly additional printed percentages only; included/unknown stay 0 to avoid double charging. Shows detected charge facts; amounts-only/ambiguous receipts require manual rate review. Existing bills retain rates when appending. No default tax guesses or balancing items. One actual bilingual synthetic scan (5109ms) correctly detected 10% service, 9% GST and 8.39 total; critical UI/host/guest tests and typecheck/build passed. A host/local user's own I’ve paid now writes received directly; guests still write sent and need host confirmation.

Last Call repeated explanations shortened; latest-route limitation and missing/expired/conflicting-service warnings remain. Leaving-now/next boarding detail moved into one disclosure. Automatic last-route and official-service checks remain mounted, no countdown logic changed. Long setup text shortened; route, safety buffer and Maps controls preserved.

## Personal payment focus — 17 September 2026

Split now leads with Your share / You pay and a large I’ve paid action. Guest identity comes strictly from the joined capability; host/local users choose their name, stored only as BillDraft.currentPersonId on their device (never sent to bill RPCs). Provisional shares, unclaimed items, saving and closed-plan explanations remain visible. Payment statuses remain manual, with sent vs host-confirmed distinctions. All people's amounts/statuses remain visible, even during unclaimed state; payment mutations require fully assigned items. Bill breakdown/sharing and people management are collapsed below the core flow.

Prominent Clear receipt asks for confirmation; cancel preserves everything. Confirm rechecks host/local authority, plan identity and busy state, empties items/claims and resets rates while retaining people. Remote payments continue using existing amount-bound settlement records; no database migration or new payment capability. Existing remote historical settlement rows are not deleted by the save-bill API.

Focused mocked 360px host/guest checks passed: personal amount/cent split, name persistence, own payment, host confirmation, refresh, no guest clear control, cancel/confirm clear, claim during autosave. Scanner import regression, typecheck/build/config passed. Screenshot visually inspected. No billable API calls or live permission re-audit this turn.

## Single receipt review confirmation — 17 September 2026

User removed the extra “I checked these differences” gate. Review keeps mismatch/missing-total/AI warnings visible, but valid items can be appended directly with Add reviewed items. Field validity, current-plan/role checks and duplicate submission protection remain. Removed obsolete acknowledgement state; updated mocked and optional paid test scripts. Typecheck, build/config and targeted mocked scan/import check passed; no paid calls. Bundle AppEntry-551975ecea38b5f7c3c1b5f58b1c7665.js.

## Simpler phone Split — 17 September 2026

Phone price fields now have bounded width/minWidth0; dish names wrap; claim controls have 44px touch targets. Routine refresh/sync controls and verbose group banner removed. Host edits automatically save after 600ms idle, retaining local pending drafts. Edits made during an in-flight save stay intact and get the returned revision for a subsequent save; remote revision conflicts remain visible, never force-overwritten. Retry/recovery is only exposed on errors; reconnect retries pending host edits. No automatic provider/paid calls added.

Workflow copy is Scan → pick what you ate → mark paid. Guests see Paid / Not paid with Paid awaiting confirmation until the host confirms receipt; no payment verification is implied. Local-only bills have a Paid button. Guest own-claim/own-payment restrictions and closed-plan guards remain. Paste import is one disclosure rather than two nested toggles. Empty local groups can add people from Split. Scan review and appending remain unchanged.

Typecheck, production build/config, mocked phone host+guest flow, in-flight edit preservation, payment/refresh, phone width and scanner-import regression passed. scripts/verify-split-phone.mjs runs with mocked RPCs (not a new live database permission audit); no billable Gemini calls this turn. Bundle AppEntry-75198a8a86c919fc431cd29d9b14085b.js. Device screenshots inspected; physical phone not directly tested. Paid controls remain briefly disabled while their specific operation is saving and require fully assigned items.

## AI-only simplified scanner — 17 September 2026

User requested complete removal of on-device OCR and the acknowledgement gate. Photo buttons are now immediately available with inline note: “Photos are sent to Google Gemini to scan. Hide personal/payment details first.” Selecting a photo starts upload/scan; opening the scanner alone makes no AI call. Two large camera/gallery cards, existing red close cross, and a separate Paste or type instead card returning to Split. Bill review/acknowledgement of discrepancies remains unchanged.

Removed Tesseract dependencies, worker bridge, old scanner/test, asset preparation build step and hosted model assets. Image resize/rotation helpers moved to receiptImage.ts. Generated public/dist OCR folders moved to ignored .expo/retired-public-ocr and .expo/retired-dist-ocr for recoverability; old source remains in Git history. Privacy and backend error text now AI-only; receipt-ai v8. No paid recognition tests repeated for this UI change.

Typecheck/build/config verification and focused mocked phone UI (inline note, no on-device choice, manual return, automatic upload, error/no automatic retry, explicit retry, review/append) passed; screenshot visually inspected. Bundle AppEntry-cf8d5dd4a6d9566dfddb7ad0c807a089.js. Existing 16 dependency advisories remain; no unrelated upgrades.

## Paid Gemini scanner released — 17 September 2026

Supersedes the pending/free-only notes below. User approved paid Gemini after explaining that unlimited rate limits are not free and a USD8 budget alert is not a hard cap. No billing settings changed. Model remains gemini-3.1-flash-lite; receipt-ai v7 deployed. Paid-service privacy notice and quota/auth errors corrected. No automatic retries or model failover. On-device and manual options remain.

One actual synthetic bilingual receipt scan via the live function succeeded (HTTP200, 5001ms including frontend/network); 5.00 and 2.00 item totals and 7.00 final total correct. Phone-sized browser consent, edit, append unclaimed items, and local save/refresh passed. This is not a real-world accuracy percentage or physical phone benchmark. No private receipt was used. Only one billable test call made this turn.

Typecheck, two validation tests, production export/config verification and mocked quota/explicit retry/review flow passed. Cloudflare Pages e7980b36, bundle AppEntry-07d5f4ed5c39eb582f9e40af2d92a7f3.js. Live test script scripts/verify-live-ai-receipt.mjs makes a paid call: run explicitly only, not as automatic CI. Mocked UI script supports BOJIO_PREVIEW_URL for public smoke checks without extra Gemini spending.

Budget caveat: USD8 is not enforced by this app. Existing publishable-key validation is public project access, NOT per-user authentication or abuse-proof authorization. Two concurrent requests are limited per isolate, not globally. User-requested budget setting has not been inspected; monitoring/stronger global spending controls remain advisable before broad sharing. Provider key remains server-side; no image or raw AI persistence added.

## Gemini receipt integration pending quota — 17 September 2026

User confirmed GEMINI_API_KEY saved in Supabase and project shows Free. receipt-ai function v5 deployed with custom project publishable-key authorization, bounded JPEG request, single Gemini call, no automatic retry/paid fallback. Gemini 2.5 Flash-Lite generateContent returned 404 despite appearing in model listing. Manually changed to Gemini 3.1 Flash-Lite, which official pricing lists as free-tier eligible. Actual synthetic receipt returned 429; repeat quota diagnostic also 429, no quota details. No successful AI extraction yet. Do NOT claim live receipt recognition works. Need user's AI Studio rate-limit screen to resolve quota/eligibility. Do not enable billing.
Frontend prepared and built locally but NOT deployed to Pages; public still ee93deef on-device OCR. New AI default includes explicit acknowledgement before image selection/upload, personal/payment detail removal warning, on-device choice, quota errors, validation, mandatory review. Privacy page updated locally. Public rollout held until actual AI scan succeeds.
Critical local checks: typecheck and 2 schema-validation tests passed; scripts/verify-ai-receipt.mjs mocked consent/quota/no automatic retry/manual retry/review/append passed. This does not verify Gemini. Current uncommitted integration work is now committed for handoff. No actual receipt images or keys saved/logged. Availability probe was removed from production function after inspecting model names.


## Automatic receipt scan — 17 September 2026

Photo/camera selection now starts OCR immediately after decoding; no second Scan tap. Progress, Cancel and errors moved above the photo. Manual retry remains; review/confirmation still required before modifying the bill. Version guards preserve cancel/new-photo behavior.
Pages ee93deef; bundle AppEntry-54efac75315879d95c86f7d36fca93a2.js. Typecheck/build pass, actual three-language automatic scans and append/refresh checked. Cancellation test now stalls only the worker script deliberately so fast scans cannot finish before the test clicks Cancel; recognition tests remain real.


## Browser OCR release — 16 September 2026

Pages deployment 776ea861; bundle AppEntry-b390ec85ae3c7608d91b926ef9408604.js.
Split now has Scan receipt for local users/hosts of open bills. Photo selection/camera, rotate, cancel, editable item review, explicit discrepancy acknowledgement, raw text, and append-only confirmation. Existing bill rates stay unchanged; empty bills can set rates in review. Summaries/charges are excluded, quantity text preserved, totals compared in cents. Discounts/rounding need manual handling; no balancing item or auto tax inference.
English + Simplified/Traditional Chinese use pinned Tesseract.js 7.0.0 and data packages 1.0.0. Engine and models self-hosted on Pages, lazily loaded in a dedicated bridge/nested worker. Receipt photos and raw OCR remain in memory, no uploads; only confirmed items enter normal bill persistence. Cancel closes workers; stale image/scan results are guarded. JPEG/PNG/WebP <=15 MB; longest decoded side resized to <=2200 px. No HEIC/PDF support; paste/manual fallback remains.
IMPORTANT BUILD: run node scripts/prepare-ocr.mjs before Expo export; npm build:web now includes it. public/ocr/ is generated/ignored; source assets come from pinned npm packages. Three compressed language models total ~6.3 MB, with additional engine download. All core variants are hosted (~51 MB total generated assets), but browser loads only its selected variant.
Critical verification: typecheck, four focused parser tests, actual non-mocked OCR through the public page with synthetic clear English/Chinese fixtures, edit/append/refresh/cancel and no POST/image upload. Observed public scan durations on this laptop: English 4171ms first run, Simplified 2645ms, Traditional 1113ms. These are not phone benchmarks or accuracy claims for real crumpled/faded receipts. Native physical camera and Safari not directly exercised. Role guard uses existing host/closed-plan checks and validates again when importing; existing shared bill RPC/schema unchanged.
npm install audit reports 16 existing Expo/tooling-tree advisories; none attributed to the new OCR packages. No unrelated dependency upgrades performed. Privacy page updated. Keep future tests critical-only per user preference.


## Special mentions — 16 September 2026

User preference: from now on reduce self-tests to critical changed-flow, saving/permission and build checks; avoid repeatedly running broad suites for small UI edits.

Supersedes the ranking notes below: main-page additional rated list removed. Other rated names live only below Top 3 in its modal; clicking opens details, never selects the meetup. Details offer “Die die want this! ❤️”: one ordinary like with a special flag, not extra ranking weight or venue confirmation. Bordered main-page mentions show restaurant and picker names together; multiple pickers share one card. Removing a mention keeps the like; normal re-swiping clears the flag. Host display name uses first non-guest participant, falling back to Host (existing host identity is not explicitly linked to a participant).
Migration 202609160011 deployed: optional client special flag, database nonnull false, like-only constraint, same capability/open-plan/deck checks. Existing device progress imports preserve mentions; Google details stay session-only. Special names resolve after refresh even outside Top 3.
Critical shared checks passed on public URL with two independent browsers and real Supabase: save failure/retry, named shared mentions including two pickers, removal, refresh, no changed confirmed venue, invalid token and closed-plan rejection. Google/OneMap were controlled fixtures for these UI tests. Temporary test outings deleted. Before the reduced-test preference, typecheck, 106 tests, full migration permission tests and phone mouse/touch checks also passed.
Latest bundle: AppEntry-b2bdde3c65702b68d342815857e48208.js. No API spending-policy changes.


## Ranking panel follow-up — 16 September, 21:42 SGT

Pages `5bbc33b1`; bundle `AppEntry-9455b54f4681e6a0a8bee798b801131d.js`.

Other rated restaurants now also appear INSIDE the Top 3 modal below the favourites, with details access and host-only meetup selection (closed plans disabled). Review/change-my-swipes moved off the main page into the top of this modal. Picking a past rating closes the modal and restores its swipe card. Empty additional rankings have a clear message. Updated phone UI regression covers modal-only review, reopening a rated card, additional restaurants and gallery return. Typecheck, 106 unit tests and production build pass.


## Latest UI follow-up — 16 September, 21:35 SGT

Pages deployment `e2cd905d`; bundle `AppEntry-ed23df74cd32fb7291276a91b86474b0.js`.

- Binary Meet options are sliding oval/circle switches: other opening hours, checked shortlist browsing, and all matching results. Stable labels, explicit On/Off, accessible checked/disabled state, click/Space/Enter support. Actions and multi-option selections remain buttons; disclosures remain expand/collapse controls.
- Neutral now takes 680ms (150ms lift, 350ms readable stamp hold, 180ms exit), versus the previous 890ms. Voting remains disabled during the animation.
- Top 3 stays prominent above the card. Further below the swipe area, a quieter name-only list shows rated active-deck restaurants outside Top 3, including neutral/pass ratings. Tapping opens existing restaurant details without voting. Normal scrolling is preserved; no scroll lock or artificial swipe threshold. Google names are resolved on viewport entry through the existing details coordinator; display data remains session-only.
- Phone mouse/touch fixture checks cover toggle click and Space transitions, faster neutral feedback, outside-Top-3 list membership and opening details, gallery separation and persisted swipe choices. Typecheck, all 106 unit tests and production build pass. No backend or spending-policy changes in this follow-up.


## Latest release — 16 September, 21:20 SGT

Pages `76c695e4`, bundle `AppEntry-74ea949784913f1cb2e45e0a0c4881bd.js`; LTA Edge v9, OneMap v12. Supersedes the checkpoint below.

- Meet now always shows a compact three-column Top 3 strip ABOVE the full-width swipe card, including medals, names and heart counts. Tapping opens detailed ranking/host confirmation. The strip uses placeholders until likes exist; no fabricated ranking.
- Top 3 and search/outing panels now close with accessible 48px red × buttons. Restaurant gallery already has the same visual. Neutral lifts 24px over 180ms, holds the ANYTHING LAH stamp for 500ms, then exits over 210ms. Buttons stay disabled throughout; vertical scrolling still does not vote.
- Last Call separately shows last scheduled services for each transit leg alongside the boarding time needed by the connected journey. Countdown remains based on the full OneMap journey, never extended just because a later isolated bus exists. Transfer warnings compare last-service arrival plus itinerary walk plus 3 minutes against the onward published final departure. Bus stop-level times are explicitly NOT a tracked same-vehicle trip: connection estimates remain estimates.
- LTA service-limits action downloads current BusRoutes pages (bounded 120 pages, 4 concurrent, 50-second deadline) and the current train GTFS archive. Pending work deduplicates; no persistent/cross-session provider result cache. Train matching requires same dated trip with correct stop order, calendar/exceptions, pickup/dropoff permission and exact normalized station names; multiple line families are refused. Bus matching requires unique boarding/alighting stop sequence and direction. Missing/ambiguous/holiday dates fail closed instead of guessing Sunday rules. MOM holiday reference checked 16 Sep 2026 covers 2026/27, including observed dates; outside coverage unavailable.
- Legacy LTA TrainServiceAlerts is queried for current normal/minor-delay versus disruption status. Reported disruption (conservatively network-wide) or a chosen journey boarding after a known final service pauses the relevant/group countdown. Special holiday extensions and planned closures are NOT comprehensively ingested; UI links to official notices and labels that gap. No live MRT platform prediction or absolute last-service guarantee.
- Real checks: dated train limits returned for Orchard→Somerset, Clementi→Jurong East, Tampines→Expo. Real OneMap 23:15 Orchard→Tampines chain had bus 190 from 09047→08069 then Bencoolen→Tampines MRT; LTA returned both last-service schedules, check ~7.6 seconds. Deliberately unmatched bus stop pair returned unavailable. Runtime secrets remain server-side.
- Verification: typecheck, 106 unit tests/32 files; phone UI fixture test covers last-service transfer warning, disruption countdown suppression/recovery, provider failure, no departure picker; mouse/touch swipe test covers visible Top 3, red ×, neutral stamp hold with disabled voting, gallery isolation and persistence. Tests distinguish fixtures from live provider calls.


Additional live check caught a genuine OneMap/LTA last-bus mismatch (OneMap returned a bus after its LTA last-service time). Countdown was suppressed. Added up to two earlier complete-journey recovery probes, with schedule revalidation; never extend the original route by arithmetic. A subsequent public Orchard→Tampines check recovered a complete route, displayed last-service times and restored its group countdown with no browser errors. The search remains bounded, not exhaustive. Current deployment uses a conservative 10-minute earlier recovery probe before the computed boundary; source timestamps and checks remain visible.

## Latest checkpoint — 16 September, Last Call automatic connected search

Supersedes historical Last Call/LTA blockers below. Pages deployment `2243a7ef`; frontend bundle `AppEntry-9f03567cffa9dc6c17565f34ac3be040.js`. OneMap Edge v11; LTA Edge v6.

- Removed visible departure-time input and legacy edit/save path; Last Call uses now automatically, including standalone origin/home mode. Existing stored commute timestamps are preserved but not used for this screen.
- Added bounded latest-connected search (up to eight OneMap checks/person, night cutoff 04:00 SGT). Checks full timed itineraries, rejects overlapping transfers, waits over 45 minutes and next-morning arrivals. This is **latest journey found, NOT proof of the absolute final service**. It is not an exhaustive timetable routing engine. Failures/expired/missing routes suppress group countdowns; individual successful results remain visible. Safety buffer selectable. Google Maps fallback stays available.
- First boarding shows scheduled itinerary time. Exact bus stop/service identifiers from OneMap enable LTA next arrivals, manually refreshable at 20-second intervals, hidden as stale after 60 seconds. MRT boarding is scheduled, NOT live platform prediction. Earlier buses are not assumed valid substitutes for the selected chain.
- Real verification: west/central/east location, driving and transit returned usable results. Search 0.7–2.6s, driving 3.6s, transit batch 5.9s; Orchard→Tampines now/23:15 calls 3.1/2.5s, latter included BUS→SUBWAY and exact boarding IDs. LTA arrivals and all three other feed endpoints pass.
- LTA actual train GTFS archive inspected: 2,348,183 compressed bytes; 17,576 trips, 333,262 stop times, 1,211 stops, 19 routes, 12 service calendars. Timetable routing is **not yet integrated**; disruption-only trip updates cannot be labelled everyday live train predictions.
- Validation: typecheck, 101 unit tests/31 files, production configuration build check, local and deployed phone UI fixture checks (no picker, automatic late routes, ETA, bounded calls, failed provider hides group countdown). Fixture UI checks do not prove live provider coverage. See `scripts/verify-public-last-call.mjs` for a separate real public smoke check.
- Known scope gap: absolute last connected public transport across all alternatives still requires a more complete timetable engine/data coverage. Do not market the bounded search as guaranteed last transport. Google spending safeguards remain removed at user request; OneMap protections unchanged.
- Public real-provider phone smoke check passed on `bojio.pages.dev`: Orchard→Tampines automatically produced a late journey, first-boarding section and complete group countdown; no provider error message or browser exception. This verifies that example, not exhaustive Singapore last-service coverage.


Updated: 16 September 2026 (Singapore time).
Repository: https://github.com/EurekaWN/bojio
Branch: main
Latest functional release: September 16 restaurant swipe cards (see docs/SWIPE_RELEASE.md).
Public app: https://bojio.pages.dev/
Deployed Pages version: d26378f9 (16 September), scroll-safe cards and red details close button.
Supabase project: jagzkkcpfeknpqprftzj; OneMap Edge function version 8 (observed remotely, not changed in this checkpoint).

## Current swipe release

LATEST LTA STATUS (supersedes blocker below): user corrected AccountKey; v5 `lta` and live checks PASS at 20:36 SGT. Bus arrivals returned/parsed, bus route records returned, and train schedule/disruption download links present. Actual response uses lowercase `link`; support both cases. Train files/coverage have not been examined and Last Call frontend is not yet connected. Next: inspect train archive calendars/stop times, map OneMap boarding stop/service identifiers to LTA, then implement and test full connected latest-journey logic. Do not claim end-to-end Last Call is done.

LTA setup checkpoint: new `lta` Edge Function v2 deployed with server-only LTA_DATAMALL_ACCOUNT_KEY, project-key authentication, bounded fixed provider endpoints, no secret/signed-URL logging and no frontend hookup. The secret exists, but real bus arrivals, bus routes, train schedule and disruption feed requests ALL returned HTTP 401 on 16 September at 20:27 SGT, including after trimming secret whitespace. Do NOT claim LTA connected. User needs to confirm actual approved AccountKey/activation. `scripts/verify-live-lta.mjs` intentionally fails until every feed is accessible. Existing frontend and OneMap are unchanged. Last-connected-service planning remains unimplemented.

Latest UI: vertical scrolling on restaurant cards no longer votes; only clear horizontal swipes do. Neutral remains a button. Top 3 is a header button opening a panel, not a sidebar; full card width is retained. Restaurant details close with a red ×. See docs/SWIPE_RELEASE.md. Last Call last-connected-service/live-arrival request is pending LTA access/coverage verification, not implemented or claimed complete. User does not yet have LTA access; direct them to the official DataMall request form, then store issued key server-side as LTA_DATAMALL_ACCOUNT_KEY. No LTA adapter exists yet.

Latest override: user also explicitly requested removal of hourly caps. Migration 010 removes hourly enforcement for all four Google Places services. Monthly/hourly usage metering, input validation and service-role permissions remain. There are no Bojio monthly/hourly spending safeguards now; Google quotas and charges still apply. This supersedes the hourly-limit statements below.

Billing policy update: user explicitly requested removing monthly Google Places safeguards. Migration 009 removes monthly enforcement for nearby, details, photos and reviews while retaining counters and existing hourly limits (10/60/60/30). No Google account settings changed. Do not claim this app now guarantees free usage. Historical 900/month references are superseded. The user's current hourly block is not removed by this change.

Latest refinement: Meet is a focused swipe screen with search/setup behind the top-right ··· modal. Large coloured vote buttons and drag stamps, medal/heart leaderboard, Google price range/category, and named-origin straight-line distance are visible on cards. Manual area changes now replace the active deck; host changes propagate to guests with optimistic deck protection. Ratings are retained, but only active venues rank. Nearby calls return up to 20, and an explicit same-radius distance-ranked follow-up can append nonduplicates. No unlimited feed or automatic wider radius. Edge v5 and migration 008 are deployed (19 migrations). See the refinement section in `docs/SWIPE_RELEASE.md`; it supersedes the fixed-deck limitation below.

Animated left/pass, right/like and up/neutral cards are deployed. Each outing has one fixed shared deck, individual confirmed progress, and a provisional Top 3 ordered by likes, then fewer passes, then deck order. Hosts confirm the final venue. Real Google photos and explicitly requested reviews work in an isolated details gallery; gallery gestures do not vote. Local progress transfers when the host starts sharing. Google display content remains session-only; saved Google venues contain only provider and place ID.

Google Edge Function is now v3; migrations 005–007 are applied (18 total). See `docs/SWIPE_RELEASE.md` for verification, billing safeguards and limitations. This supersedes the old single-vote UI and historical no-photo/review scope below.

## Previous Google release

Google restaurant discovery, ID-only shared selection/voting, session details resolution, attribution and public privacy/terms are deployed and verified. See `docs/GOOGLE_PLACES_RELEASE.md` for complete checks, timings, quota limits and limitations. Edge function `google-places` is v2. Both new migrations are applied; all 15 migrations tested. The historical backend-only checkpoint below is superseded; its NEXT paragraph is no longer the active task.

## Historical September 16 Google Places backend checkpoint (superseded)

Google Places API (New) is now verified with the user-configured `GOOGLE_PLACES_API_KEY` Supabase secret. Never put this key in the frontend, logs or Git. A new `google-places` Edge Function v1 is deployed with custom project-key validation, 12-second provider timeout, no automatic retries, no response caching, and credential/address-free timing logs. Existing OneMap function was not modified.

Migration `202609160002_places_budget.sql` is applied live. It reserves an attempt before Google is called, serializes the global counter across Edge instances, limits this app to 900 Nearby Search Enterprise attempts per Pacific billing month and 10 per hashed connection bucket/hour. Only service_role can consume the budget. Failed attempts are conservatively counted. This is NOT an account-wide Google billing cap: other apps, console calls or changed Google pricing can incur charges. No extra Details, Photos, Reviews or Text Search SKUs are used.

Verified: real west/central/east searches returned ten restaurants each, all ten rated; listed hours available for 10/4/9 respectively. Final measured response times were 655/727/707ms. Initial deployment requests intermittently returned platform 404s before the final full live test passed; do not hide this history or infer latency guarantees. Five Google attempts were made across diagnostics and the final test. Access rejection and invalid-coordinate rejection passed. Logs MCP lacks the debugging scope; function deployment and SQL scopes work.

Checks: `node scripts/verify-places-budget.mjs` passed (permissions, client/global caps, rollover); all 13 migrations and existing database permissions tests passed; typecheck and 77 unit tests passed. Run live checks explicitly with `node --env-file=.env.local scripts/verify-live-places.mjs` (each successful run uses three search attempts).

NEXT: integrate real results into Meet with Google Maps attribution, rating count and listed-hours disclosure; preserve voting, final selection and automatic travel times. No frontend changes or Cloudflare deployment were made in this checkpoint. Do not tell the user restaurant search is already visible. Solve provider-data persistence first: current plan/vote JSON saves whole Place objects, while Google Places policies generally prohibit storing content other than allowed exceptions (place IDs indefinitely, coordinates up to 30 days). Use ID references plus intentional hydration or an independently sourced location, without relabelling Google data as OneMap. Add public privacy/terms pages and attribution before publishing the UI. Avoid recurring billable searches on renders/polls. Sources: https://developers.google.com/maps/documentation/places/web-service/policies and https://cloud.google.com/maps-platform/terms/maps-service-terms and https://developers.google.com/maps/documentation/places/web-service/nearby-search.

This replaces the old prototype handoff. Start here and read docs/RELIABILITY_RELEASE.md for measured release evidence. Older roadmap documents may describe already-replaced prototype behaviour.

## September 16 usability update

### Released: shared venue voting

Local implementation adds one vote per host/registered guest, a tick above the voter's venue card, counts, move/remove votes, and host-only final venue confirmation. Votes are separate from plan saves, so they cannot overwrite pending outing edits or change journeys. Guest-suggested addresses are treated as unverified, not operator facts. Failed writes retain the previous confirmed vote; counts poll every 15 seconds.

Migration `supabase/migrations/202609160001_venue_votes.sql` is applied to the live project. Supabase OAuth reconnection succeeded; the login needed explicit supported scopes (organizations:read, projects:read, database:read, database:write). Voting bundle: `AppEntry-3410ce24b7e66f46f4787d68e3c73ace.js`.

Live voting browser verification passed against both localhost and https://bojio.pages.dev after deployment. A public-run setup attempt hit a Supabase connection timeout; a subsequent test assertion was fixed to wait for the confirmed tick removal rather than the temporary saving-button label. Final full public run passed and cleaned up its own test data.

Checks passed: typecheck, 77 unit tests, all 12 migrations in PGlite including vote ownership/repeat/move/removal/closed-plan/RLS tests, production build, `verify-voting.mjs` (two isolated browser contexts with fixture RPCs, including failure/retry), and existing venue-selection checks. `verify-live-voting.mjs` uses real Supabase public RPCs and two isolated host/guest browser sessions to verify polling counts, persisted ticks, moving/removing votes, invalid capabilities, direct-table denial and closed plans; each run deletes only its own test plan and votes. Its unrelated transport requests are stubbed, so it does not verify live routing.

Latest follow-up: Meet automatically fetches transit durations for the displayed venue cards (initially three), with small per-person lines and missing-origin labels. Removed comparison selection/buttons; existing successful request results are reused within the mounted screen, and choosing a venue no longer invalidates them. Past meetup times explicitly use now. Last Call always displays a leave-by summary with the specific unavailable reason; individual returned journeys show labelled departure/arrival times and a future safety-buffer countdown even if the group is incomplete. No final-service guarantee.

Added `scripts/verify-auto-meet.mjs` for automatic loading, partial setup, no selection refetch, and narrow layout. Live OneMap west/central/east searches, driving and transit passed September 16; transit batch took 5.929s. New bundle: `AppEntry-f094d5075b47ffbbab80cadc48474311.js`.

- Meet shows the selected venue and unfinished participant setup at a glance. Selected cards link straight to journeys; secondary rides/bill actions are collapsed.
- Location search explicitly requires tapping a returned result; selection clears the query while preserving the confirmed location label.
- Last Call replaces a disabled check button with a specific Meet setup action or a next-field instruction for standalone journeys. Missing participants are named. Switching to a quick journey retains the departure venue.
- Type-check and 77 unit tests passed; phone-sized venue-selection and Last Call browser fixtures cover incomplete setup, actionable navigation, refresh, partial routes, automatic recheck and guest/closed restrictions. These fixture routes are not evidence of live provider availability.
- Production bundle: AppEntry-0e605c2a14a0603d99367b82fccf8256.js. No backend or credential changes.

## User priorities and agreed limits

Make the existing functions intuitive, reliable and fast; do not prioritize adding tabs or prototype features. Finish, test, and push completed builds. Publish verified web changes to the existing Cloudflare Pages project.
Use free tiers only; never activate paid APIs or upgrade accounts without new authorization.
Shared cars support FOUR passengers maximum, excluding the driver (not the earlier three-person limit). Larger outings remain supported, up to the existing 12 participants.
Never invent journey times, deadlines, fares, savings, reviews or live opening status.
Google Maps links are the agreed fallback when OneMap is unavailable. Google Places, photo and review requests now use metered APIs behind conservative app-level free-allowance caps; these are not account-wide billing guarantees. No automatic paid upgrades.
Manual bill/fare entry and manual payment status only. OCR, payments verification, bookings and app-store distribution wait.

## Start on the other PC

If already cloned, preserve local edits before pulling:

```sh
git status
git pull --ff-only origin main
npm ci
npm run typecheck
npm test
npm run web -- --port 8081
```

Otherwise clone the repository first. Use Node 24 LTS to match the tested runtime. Do not copy node_modules from the old PC.
Recreate ignored .env.local from .env.example:

```dotenv
EXPO_PUBLIC_SUPABASE_URL=https://jagzkkcpfeknpqprftzj.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<project publishable key from Supabase dashboard>
EXPO_PUBLIC_APP_URL=https://bojio.pages.dev
```

The publishable key is public client configuration. Do not use a service-role/secret key here.
OneMap ONEMAP_EMAIL and ONEMAP_PASSWORD are already stored as Supabase Edge secrets; no provider secrets are needed in the frontend or chat.
Wrangler and Supabase CLI/MCP authentication do NOT transfer through Git. Sign in securely on the new PC only if deployment/backend administration is needed.
The old Windows shell had no npm on PATH, so commands used local node_modules/.bin/*.cmd. A normal Node installation on the new PC should make npm scripts work.

IMPORTANT: browser-local drafts, unsynced edits, guest/host capabilities, quick journeys and entered ride fares do not transfer through Git. Do not clear browser storage to fix UI issues. Shared plans require their invitation link and appropriate role capability; a plan code alone does not grant host access. Preserve the original browser for any unsynced work.

## Current real functionality

- Meet: empty initial group, 12 source-checked venues, OneMap address search, immediate venue selection, optional comparison of up to three venues. Only complete returned public-transport results can win the fairness ranking. Locations require selecting an actual search result, not just typing a station name.
- Last Call to Zao: standalone origin/destination or partial Meet draft; scheduled itineraries with steps, dates in Singapore time, leave-by = itinerary start minus safety buffer. Missing or expired results cannot produce a reassuring group countdown. This is not a guaranteed last-train finder.
- Shared rides: direct road journeys plus at most 12 undirected home pairs, no more than 36 directed legs for 12 people versus the previous 144. Geography selects candidates only. Confirmed groups of 2–4 require returned legs for every order; evaluate up to 24 orders, cap each rider's detour at 15 minutes. Optimize riders sharing, worst detour, then total driving duration. Comparisons are explicitly shortlisted, not exhaustive.
- Fare: entered quoted/actual fare splits exactly to cents; device-only, separate from food bill. Maps links support all three intermediate drop-offs for four riders.
- Shared plans/Split: Supabase guest capabilities without accounts, host-only edits/receipt confirmation, guest own claims/sent status, explicit Save/Sync, reconnect recovery and conflict rejection. Payment statuses are manual tracking.
- Reliability: one plan subscription across Meet/Last Call/rides/Split; coordinated identical in-flight requests; stale-request cancellation; unchanged successful transit results retained for the mounted screen; 300 ms search debounce; eight-second slow-service fallback; corrupt saved data is not silently replaced. No cross-session provider cache.

Core code: src/data/outingStore.ts, src/data/travelProvider.ts, src/features/travel/coordinator.ts, src/features/rides/actualRides.ts, src/features/rides/shortlist.ts, src/screens/*.tsx, supabase/functions/onemap/index.ts.
Database: 11 migrations already deployed. Do not reinitialize or reset the project. RLS tables default-deny; scoped SECURITY DEFINER RPCs implement guest/host capabilities.

## Latest reported “can't click” issue

The user's in-app localhost preview was still running an OLD loaded build. Its Meet screen hid venues until all starting points were resolved. Reloading that tab loaded the current interface without clearing the saved draft.
After reload, clicking Meet here visibly selected Swee Choon in the user's local draft. This was a diagnostic selection, not a new product default.
Check scheduled journeys was legitimately disabled: both participant origins were saved text without confirmed coordinates. The screen showed 0 of 2 destinations ready. Instructions given: Meet → Search location → tap the correct result for at least one person, then return to Last Call.
Do not infer that all click problems are resolved on every device. If reported again, inspect the actual URL, loaded build, role, disabled reason, and saved coordinates.
Useful next improvement: make unconfirmed locations and disabled-button prerequisites more obvious/actionable, without guessing coordinates or silently choosing search matches.

## Verification and deployment

Functional release passed 77 unit tests, typecheck, production export and build configuration checks.
Public URL checks passed two independent sessions creating/joining, guest claims, sent/receipt permissions, offline host edits across navigation, reconnect, invitation reopening, venue selection, four-person fares, partial/standalone Last Call, storage recovery and timeout fallback.
On 15 September real west/central/east searches, driving legs AND transit itineraries all returned usable results. Transit batch took about 3.9 seconds that run; earlier calls timed out. Do not promise continuous provider availability or call fixture tests live verification.
Phone click-to-screen lab measurements were 79–141 ms; initial loading varied and no proven initial-loading speedup was claimed. See docs/RELIABILITY_RELEASE.md.

```sh
npm run typecheck
npm test
node scripts/verify-database.mjs
node scripts/verify-travel-handler.mjs
node scripts/verify-last-call.mjs
node scripts/verify-venue-selection.mjs
node scripts/verify-bill-storage.mjs
node scripts/verify-four-riders.mjs
node scripts/verify-slow-routes.mjs
node scripts/verify-sharing.mjs
node scripts/verify-preview.mjs
node --env-file=.env.local scripts/verify-live-travel.mjs
node --env-file=.env.local scripts/verify-live-database.mjs
```

Browser scripts default to localhost:8081; set BOJIO_PREVIEW_URL to test production. They use Playwright with the msedge channel, so install Edge or deliberately configure an available browser. Fixture scripts label their mocked responses.
Live tests consume free quota and create test data. verify-live-database removes only its own generated plan. verify-sharing leaves generated browser-test plans for inspection; never delete arbitrary plans.

Cloudflare project bojio is Direct Upload, not Git-integrated: pushing does NOT deploy.
Read the Wrangler skill/current local help before publishing. The pinned Wrangler version is 4.131.2.
Build with npm run build:web, then deploy with the existing npm run deploy:web workflow after authenticating. Reuse project bojio and branch main; do not create another account/project or enable paid services.
Browser tests write screenshots into ignored dist; always perform a fresh build before uploading so screenshots are not published. Verify the public URL after deployment, then push the verified code.
Expo can remove/regenerate tracked expo-env.d.ts; its expected content is the single expo/types reference. Preserve unrelated user changes.

## Handoff snapshot caveat

Four previously existing edits in legacy maps.ts/maps.test.ts and deadlineStatus.ts/deadlineStatus.test.ts were intentionally excluded from c19255b and are included unchanged in this handoff at the user's request to push the remaining code.
These helpers are currently referenced only by their tests, not by the active screens. The legacy deadline changes remove immediate-past and after-midnight regression tests and alter those semantics. Do not reuse that legacy helper for production scheduling without reviewing/restoring the needed behaviour; active Last Call uses src/features/travel/types.ts instead.
No passwords, provider secrets, local environment files, browser role capabilities or machine authentication are committed.
