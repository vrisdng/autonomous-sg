# Apple67

**Supper plans, settled.** A Singapore-first group utility combining fair halfway meeting spots, one-link bill splitting, and last-train planning.

The web demo opens on a scrollable discovery homepage (`#discover`). Its buttons lead into the existing outing app, which has five connected tabs:

- Home — the fast entry point for a spontaneous supper plan
- Meet — participant origins and ranked late-night venue suggestions
- Split — item claiming, cent-safe tax/service calculations, and settlement sharing
- Share ride — transport-preference-aware carpool pairs, convenient drop order, estimated fare split, and combined food/ride dues
- Last Call to Zao — a transport-preference-aware group deadline and individual public-transport journey cards

The M1 cloud flow is also underway: a host can publish a Meet plan to Supabase, share a code or deep link, and guests can add or update their own participant details without an account. Supabase Realtime pushes plan changes to open screens, with periodic refresh as a connection fallback. SplitLink inherits the active Meet group; hosts can publish a shared bill, each guest capability can change only its own item claims and payment-sent state, and the host confirms received payments.

## Run it

Requirements: Node.js 22+ and the Expo Go app on your phone.

```bash
npm install
npm start
```

Scan the QR code with Expo Go. You can also run `npm run web` for a browser preview.

For the web demo, open `http://localhost:8081/#discover` after `npm run web`. Use **Plan & swipe with friends** (or tap a post) to open the existing party flow. Create a party, share its invite, then continue to Meet to swipe the shared restaurant shortlist. **Browse solo** opens the local Meet draft. The twelve discovery stories and photos are illustrative; shared plans, group votes, invitations, bills and journeys use Apple67's existing flows.

Run `npm test` for the calculation and plan-link regression suite, and `npm run typecheck` for the strict TypeScript check.

## Optional cloud plans

Local drafts work without provider credentials. To enable cross-device Meet plans:

1. Create a Supabase project and apply every migration in [`supabase/migrations`](supabase/migrations) in filename order.
2. Copy `.env.example` to `.env.local` and add the project URL and publishable key. Legacy projects can still use their anon key during migration.
3. Restart Expo.

See [`supabase/README.md`](supabase/README.md) for the security model and deployment notes. Never place a service-role key in the app.

## Project map

```text
App.tsx                 App shell and tab state
src/components/        Shared UI and bottom navigation
src/screens/           One file per core product flow
src/data/mocks.ts      Clearly isolated prototype data
src/data/remotePlans.ts Supabase RPC adapter for shared plans
src/features/          Pure ranking, splitting, train, and link logic
supabase/              Database migration and backend setup notes
docs/PRODUCT.md        Product scope, rules, data model, roadmap
CONTRIBUTING.md        Prompt pattern for vibe-coding safely
eas.json               Expo Application Services build profiles
```

## Important

Venue hours and scheduled transit routes use server-side Google provider boundaries when configured, with timestamps in the UI and clearly labelled prototype fallbacks. Ride groupings and car fares remain prototype estimates and must not be presented as live pricing.

## Next build

Apply the latest Supabase migrations, deploy the provider Edge Functions, and verify venue, transit, and traffic-aware driving results across host and guest devices. Ride-hail fare quotes remain a future provider integration; estimated fares stay clearly labelled until then.
