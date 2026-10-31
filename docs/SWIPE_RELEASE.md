# Restaurant swipe release — 16 September 2026

## Scroll-safe gesture refinement

Published deployment: `d26378f9`, bundle `AppEntry-ca5c19ce0a32fb72b2e598bdeb60ba35.js`.

Card width is unchanged. Top 3 now opens from the header into a separate panel; host confirmation closes it back to the card screen. Vertical card gestures scroll and never vote; neutral is button-only. Horizontal voting requires a clear horizontal intent (16 px, 1.5× vertical movement) and a 90 px release threshold. Web touch-action is pan-y. Details now close using a red circular × with a 48 px target and accessible label. Touch emulation verifies actual vertical scroll displacement without a vote or accidental details opening, plus left/right voting, neutral button, ranking panel and gallery navigation. Mouse regression also passed. No backend changes in this UI update.

Pending user request: Last Call should find the latest complete connected journey and show first boarding arrivals, not require an arbitrary leaving time. Current OneMap flow is only scheduled departure lookup. Do not relabel it as a verified final service. LTA DataMall advertises bus arrivals, bus first/last stop times and train GTFS schedule/updates; access and coverage need verification. Asked user whether LTA access exists; never request its private key in chat.

## Latest billing policy override

Subsequent explicit instruction: remove hourly caps too. Migration 010 removes those caps for nearby, details, photos and reviews. Usage counters, validation and authorization are retained. Bojio no longer enforces monthly or hourly request ceilings; Google quotas/billing remain external. Edge errors no longer claim an app hourly limit. Tests verify previously exhausted buckets succeed and increment counters without weakening permissions.

User explicitly requested removal of the monthly safeguard. Migration 009 removes monthly enforcement for all four Google services, retaining monthly metering and hourly per-connection limits (nearby 10, details 60, photos 60, reviews 30). No quota counters are reset and no Google account/billing settings are changed. Monthly usage may now exceed free allowances and incur charges. Historical 900-attempt ceilings below no longer apply. The live Edge error now identifies an hourly limit instead of incorrectly mentioning a monthly cap.

## Card-first refinement (latest)

Deployment `22cca664`, bundle `AppEntry-2aabf888b01b56df0035adb3e60faeeb.js`. Meet now opens directly on cards when locations/results are ready. Search, setup, sharing and browse controls are in a top-right ··· modal. Empty users get explicit quick-area choices, not invented nearby results. Large pass/neutral/like circles and drag-driven overlay stamps communicate each direction. Top 3 uses medals, heart totals and proportional bars; exact counts remain visible.

Google priceRange/priceLevel are requested in existing Enterprise calls (no higher SKU). Cards show the returned SGD range or category, never a made-up average. Missing prices are explicit. Distance uses Haversine coordinates and is labelled straight-line from the named participant: registered guest's own entry, first listed participant for host/local use. It is not a routing API call or an inferred current GPS position. Provider price text remains session-only.

Area selection triggers a new search and replaces active cards; explicit refresh does the same. Host-only `refresh_swipe_deck` normalizes ID-only references and checks the expected prior deck before mutation. Existing ratings remain, and only active venues rank. Appending deduplicates. Migration 008 is deployed; 19 migrations pass local DB tests including host/guest, stale-deck and closed-plan checks. Google Edge Function v5 returns up to 20 per nearby call. At the end, Find more nearby uses distance ordering within the SAME radius and appends new IDs. Repeated results show an exhaustion message. There is no unlimited pagination; deck safety limit is 60, provider/application request quotas are unchanged, and 5 km requires explicit selection.

95 tests / 30 files and TypeScript pass. Empty-browser UI regression covers first cards, same-radius append, manual OneMap-area replacement, menu closing and preserved likes. Touch UI tests cover price/distance, card position near top, menu-hidden criteria and opacity of all three gesture stamps. Live Google check returned 20 restaurants, 14 with price information, in 2,488 ms (one sample, not a guarantee). Shared browser tests cover guest propagation of a changed active deck. Phone verification is browser emulation, not a physical-device or Core Web Vitals certification. Earlier fixed-deck/10-result statements below describe the previous release.

Public app: https://bojio.pages.dev/  
Pages deployment: `ff8d49f9`  
Bundle: `AppEntry-a7e41323e3df9311bd97b1d6766b0c29.js`

## Behaviour

- Right = like, left = pass, up = neutral. Buttons provide the same actions. Ratings can be changed.
- One fixed deck per outing; guests use the host's deck. Progress is individual. Existing single votes migrate to likes; local host progress can transfer atomically into a shared deck.
- Top 3 uses most likes, then fewer passes, then original deck order. Only liked restaurants appear. Neutral and not-yet-rated remain separate. Rankings are provisional until everybody has rated the deck. Host confirmation remains separate.
- Tap a card for its photo gallery and optional Google reviews. Gallery gestures do not cast votes. Reviews are Google's limited relevant selection, not every review. Author attribution and Maps links are displayed.
- Google venue references alone are saved. Names, photos, addresses, ratings, coordinates and reviews stay in active-session memory. Photos are retrieved from Google's image service; no durable photo cache is introduced.
- Shared writes require the existing host/guest capability. Failed writes retain the current card and previous confirmed rankings, with an error. They do not silently count as saved. There is no offline swipe outbox: retry a failed rating when connected.

## Backend and costs

`google-places` Edge Function v3 is deployed. New migrations `202609160005_restaurant_swipes.sql`, `202609160006_places_media_budget.sql` and `202609160007_swipe_local_progress.sql` are applied.

Attempts are reserved atomically before provider calls, including failed attempts. Each SKU has a separate 900-attempt monthly cap: Nearby Search Enterprise, Place Details Enterprise, Photos, and review-bearing Place Details Enterprise + Atmosphere. Per-connection hourly limits are respectively 10, 60, 60 and 30. Requests fail closed if budget protection is unavailable, with no automatic billable retry.

Google's published free monthly allowances were checked during implementation: the relevant Photos and Details Enterprise + Atmosphere allowances were 1,000 each. These safeguards are app-level, not an account-wide billing ceiling; other consumers of the same billing account and future pricing changes can incur charges. See [pricing](https://developers.google.com/maps/billing-and-pricing/pricing) and [Places policies](https://developers.google.com/maps/documentation/places/web-service/policies). Keep the API key server-side.

## Verification

- TypeScript check and 92 tests across 29 files passed.
- All 18 migrations passed local database verification, including ownership, invalid capabilities, closed plans, fixed decks, local-progress import and Google ID-only persistence.
- Budget tests passed for separate monthly/hourly limits, rollover and permissions.
- Production export and web-build verification passed.
- Mouse and CDP touch-emulated phone tests passed for all three directions, animation completion, gallery gesture isolation, refresh, changing ratings and narrow layout. Final public deployment passed the touch fixture suite. Fixture restaurants are test data, not live-provider evidence.
- Two independent browser contexts passed the live Supabase flow on the public app: shared deck, host/guest ratings, failed-save retry, polling, host confirmation/save, refresh, invalid capability and closed-plan rejection. Temporary test plans were removed. This run used fixture provider responses.
- Separate real-provider checks returned and verified a real image and five reviews. Measured API response times in that sample: photo 2,123 ms; reviews 938 ms. The public browser rendered a real Google photo and reviews, with no vote caused by browsing and only IDs in persistent Google venue storage. These are samples, not latency guarantees.

## Limits and next checks

- Phone testing used browser touch emulation, not a physical phone. Core Web Vitals were not measured or declared passed.
- Bundle grew from roughly 593 kB to 758 kB uncompressed with image, modal and animation support. Provider latency is separate from local interaction responsiveness.
- The outing deck stays fixed once started; refreshing discovery does not replace everybody's cards or erase ratings. There is no deck-reset UI in this release.
- Guest voter counts include joined guests, not unclaimed participant placeholders. Removed guests no longer affect ranking.
- Quota exhaustion can make media unavailable; Maps links remain available. Opening information is listed schedule information, not guaranteed live opening.
- OneMap, food bills and shared rides were not live reverified in this swipe release; do not treat these tests as new routing/payment evidence.
- Earlier single-vote UI verification scripts describe the previous interface. Use `verify-swipe-ui.mjs`, `verify-live-swipes.mjs` and `verify-public-swipe-media.mjs` for the new flow. Live media checks consume provider allowance; run deliberately.
