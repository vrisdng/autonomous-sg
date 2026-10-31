# Reliability and speed release — 15 September 2026

## Behaviour

- Shared cars accept at most four passengers, excluding the driver. Every confirmed candidate requires returned direct legs and all inter-home legs; all drop orders are evaluated. Each rider must have no more than 15 minutes added to their direct journey.
- Up to 12 nearby home pairs are shortlisted geometrically. Matching uses real road durations, not geometric estimates. A 12-person comparison needs at most 36 directed legs instead of 144. Results are not exhaustive or booking quotes.
- Identical in-flight journeys are coordinated by coordinates and departure time. Subscriber cancellation does not cancel someone else's request. Completed successful transit results remain attached to unchanged screen inputs; no cross-session provider cache is introduced.
- Meet selection never waits for ranking. Last Call works independently and with incomplete Meet drafts. Eight-second slow-service prompts link to Google Maps without manufacturing schedules.
- Meet, Last Call, shared rides and Split use one plan subscription. Explicit shared Save/Sync remains. Corrupt local data is not replaced with an empty draft; fare writes are ordered. Ride fares are device-only and separate from food bills.
- OneMap Edge version 7 preserves per-route failures and emits only action/outcome/elapsed-time diagnostics, never keys or personal locations.

## Verification

Type checking, 77 unit tests, local database permission checks, live database permissions, two independent browser sessions, offline/reconnect, corrupt storage, stale requests, four-rider cents/waypoints and slow-provider fallbacks were checked locally before deployment.

Live OneMap checks: west/central/east address search succeeded (4,251 / 1,004 / 2,071 ms). Three driving legs returned in 1,357 ms. Three scheduled transit itineraries returned in 3,917 ms. These are measurements of this run, not an availability guarantee; previous transit calls timed out.

Before-deployment phone baseline (local headless Edge, fresh 390×844 contexts, unthrottled): first-contentful-paint 3,152 / 432 / 524 ms; script payload approximately 165 KB transferred; automated tab-click-to-screen 86 / 65 / 75 ms. No horizontal overflow. These are lab samples, not field Core Web Vitals or a Lighthouse audit.

## Production verification

Cloudflare deployment `cc3429a1` serves https://bojio.pages.dev/ with bundle `AppEntry-357e6ab19b5adeded7b6f21615e460bc.js`. Public-URL checks passed for two-session sharing and bills, live address/drive flows, venue selection, partial/standalone Last Call, four-rider fare persistence/Maps waypoints, bill storage recovery and eight-second timeout fallback. Test scenarios using deterministic schedules or failures are explicitly labelled fixtures in their scripts.

After-deployment phone samples using the same measurement script: first-contentful-paint 852 / 576 / 2,288 ms; approximately 168.5 KB transferred script; automated click-to-screen 141 / 111 / 79 ms; no horizontal overflow. The payload grew about 3.4 KB compressed. Network variation prevents a defensible claim of faster initial loading; all measured local tab transitions remained under the 200 ms target. The proven request-count improvement is the bounded driving shortlist and retaining unchanged Last Call routes.

Free-tier limits remain unchanged; no paid service was activated. The live database verification removed its own temporary plan; browser sharing tests retain their generated test plans for inspection. No user plans were deleted.
