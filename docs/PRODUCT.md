# Bojio? — product brief

## One-line pitch

Bojio? turns “supper?” into a plan: find a fair late-night food spot, split the bill through one link, and make sure everyone can still get home.

## Target user

Singapore friend groups making spontaneous late-night plans. The wedge is supper; the underlying job is coordinating a group without one person doing all the admin.

## MVP flows

1. **Meet halfway** — collect each person's starting point, compare travel time rather than straight-line distance, then rank actually-open supper spots.
2. **SplitLink** — photograph or enter the bill, share a guest link, let each person claim items, then calculate service charge, GST, shared items, and leftovers.
3. **Last Call to Zao** — show each person's last viable public-transport route, a safe leave-by time, and the earliest deadline for the group.
4. **Same Way, Can Share?** — pair people travelling in compatible directions, compare shared versus separate rides, choose a drop order, and keep ride fare separate from the food bill.

## Product principles

- Guests should not need an account to join a plan or claim a bill.
- Make the answer visible before asking for details.
- Use Singapore language lightly; clarity beats forced slang.
- Travel-time fairness matters more than geographic midpoint.
- Never claim live hours or transit timing unless the data is live and timestamped.

## First data model

- `Plan`: id, host, date/time, status, chosen venue
- `Participant`: display name, origin, transport mode, latest-arrival/leave preference
- `VenueCandidate`: coordinates, hours, cuisine/tags, price band, per-person travel times
- `Bill`: restaurant, subtotal, service charge, GST, items, rounding
- `Claim`: participant, item, quantity/share
- `Journey`: participant, destination, last departure, leave-by time, confidence/timestamp

## Monetisation, after retention

- Venue promotions clearly labelled as sponsored
- Group deals or booking/referral fees
- Optional Bojio+ features for regular groups, saved preferences, and trip history

Do not add ads to the core decision flow before proving that groups return and successfully complete plans.

## Milestones

- **M0:** interactive local prototype (this repository)
- **M1:** shareable plan links and persisted groups
- **M2:** real place search, opening hours, and travel-time ranking
- **M3:** receipt capture and collaborative item claiming
- **M4:** live last-train calculations and notifications
- **M5:** private TestFlight / Play testing, analytics, and store-readiness

## Current progress

The real-data pilot is now the active implementation. See [live verification](LIVE-VERIFICATION.md) for measured results and remaining release gates, and [free service setup](FREE-SERVICE-SETUP.md) for deployment. Normal Meet, Last Call, and shared-ride screens no longer use prototype timing or fares. Initial groups and bills are empty. Public cloud deployment and usable transit responses are still pending.

The milestone notes below describe the earlier prototype and must not be treated as proof of live deployment:

- **M0 complete:** Meet, manual SplitLink, Last Call to Zao, and Same Way, Can Share? are connected, editable, and locally persisted.
- **M1 implementation complete, verification pending:** hosts publish capability-protected plans and bills; guests update only their own participant and claim records; Realtime broadcasts refresh open plans and bills with polling as fallback. Hosts can close plans into read-only mode, reopen them, renew 30-day access, or permanently delete all plan data.
- **M2 provider boundaries complete, deployment verification pending:** timestamped Google Places venues, scheduled transit routes, and traffic-aware driving durations use server-side Edge Functions with explicit prototype fallbacks.
- **M3 underway:** collaborative item claiming, receipt-text extraction, and amount-aware payment settlement tracking are implemented. Guests mark only their own transfer as sent; hosts confirm receipt. Camera OCR remains future work.
- **Commute choice implemented:** each participant chooses Train, Shared ride, or Either. Capability-scoped shared-plan updates carry the choice into filtered train deadlines and ride groups.
- **Next:** deploy and verify migrations plus provider functions cross-device, then add receipt-image capture/OCR.
