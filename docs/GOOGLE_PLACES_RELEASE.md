# Google-powered Meet release — 16 September 2026

Public release: https://bojio.pages.dev/ · Pages deployment `25ed4a77`.
Bundle: `AppEntry-0f3935cb2160014de464cfc96c175277.js`, 592,678 bytes (previous release reported approximately 580 kB).

## Behaviour

Meet searches Google Nearby Search once when a geographic midpoint or explicit area becomes available. It shows up to ten popular restaurants within 2 km, initially three matching the meetup's listed hours. Unknown/outside-hours results are opt-in; an explicit wider search uses 5 km. Changed participant locations prompt a manual updated-area search. Tab switches and plan polling reuse session results. These are geographic/popularity results, not a guarantee of equal travel or opening.

Local selection, capability-based shared voting and host final confirmation accept Google place IDs. Search/details data are retained only in active-session memory. Drafts, recovery copies, votes and server plan snapshots store Google references only. Home, Meet, Last Call and rides resolve the selected reference through a shared loader with two-request concurrency. Failed details remain selected and offer retry/Maps. OneMap still supplies journeys; unresolved destinations cannot produce countdowns. Quick-commute copying does not persist Google locations.

The existing checked shortlist and OneMap address search remain alternatives. Restaurant cards carry Google Maps attribution and returned third-party attribution. Public privacy and terms pages are included. Ratings/hours come from Google; reviews/photos open externally rather than invoking extra paid APIs.

## Services and cost safeguards

- Google Edge function v2 and migrations `202609160003_google_venue_references` / `202609160004_places_details_budget` deployed. No existing live legacy Google venue rows needed removal (pre-migration count was zero).
- Nearby Search Enterprise and Place Details Enterprise each reserve at most 900 attempts per Pacific billing month, across all Edge instances. Connection limits: 10 search / 60 details attempts per hour. Failed provider attempts count. Budget failure prevents calls; no automatic paid retries.
- Google currently lists 1,000 free monthly events for each of these Enterprise SKUs. Other projects on the billing account share allowances; these safeguards do not guarantee an account-wide zero bill. Recheck https://developers.google.com/maps/billing-and-pricing/pricing before changing masks/caps.
- Storage/attribution references: https://developers.google.com/maps/documentation/places/web-service/policies and https://cloud.google.com/maps-platform/terms/maps-service-terms.

## Measured verification

- Typecheck; 87 unit tests across 28 files; all 15 SQL migrations and existing capability/claims/conflict/closed-plan checks passed in PGlite. Separate budget tests cover both SKUs, access denial, rollover and caps. New Google tests cover ID-only storage, overnight/week-boundary/24-hour/dated hours, midpoint, details deduplication/concurrency, failure retry and preservation of prior search area/results.
- Real Google west/central/east search calls returned ten restaurants each. Search durations: 2,098 / 782 / 853 ms. Details durations: 923 / 691 / 781 ms. No provider-content responses or private credentials were saved in test logs.
- Controlled phone UI test passed locally and publicly: automatic visible journeys, instant selection, ID-only persistence, refresh, quota failure preservation, tab reuse and width. Public selection feedback measured 49–63 ms including automation overhead; browser navigation DOMContentLoaded 477 ms / load 481 ms in one run. These are samples, NOT Core Web Vitals or latency guarantees.
- Public two-session Google voting test used real Supabase with fixture provider responses. Passed tick/count polling, move/remove, host confirmation, refresh, reference-only server storage, invalid capability, direct-table denial and closed-plan restrictions. Temporary test records were deleted.
- Public full outing test used real Google restaurant discovery and Supabase; OneMap was fixture-controlled. Passed UI plan creation, invite clipboard, direct invitation opening, guest joining, bill claims, offline guest failure/retry, sent/host receipt tracking, guest permissions, refresh, host offline edits across navigation and reconnect, and receipt invalidation after amount change. Deleted only its own temporary plan/bill/votes.
- Existing shortlist selection and Last Call fixture regression checks passed. Live OneMap was NOT reverified in this release; provider latency and availability remain separate from UI responsiveness.

## Re-run

`node scripts/verify-google-meet.mjs` uses fixtures. `node --env-file=.env.local scripts/verify-live-places.mjs` consumes three real searches and three details attempts. `verify-live-google-voting.mjs` uses real temporary database records with fixture Google data. `verify-google-outing.mjs` uses real Google and database records and requires SPA hosting for invitation paths. Set `BOJIO_PREVIEW_URL` to the target; defaults are local port 8081. This development session used port 8082 because the previous port 8081 server returned empty responses.

Remaining limitations: no live opening guarantee, no last-service guarantee, no embedded restaurant map or in-app review/photo API, no account-wide billing cap, no measured Core Web Vitals. Broader soak testing and real-device mobile testing remain advisable.
