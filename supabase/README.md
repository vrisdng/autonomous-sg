# Supabase setup

This directory contains the cross-device plan migrations. It keeps all tables behind row-level security and exposes narrow capability-scoped RPCs to the anonymous client:

- `create_plan` publishes a plan and stores a hash of its host capability.
- `get_plan` opens a non-expired plan by its six-character code.
- `update_plan` requires the unguessable host capability generated on the host device.
- `upsert_guest_participant` gives a guest one private capability that can create or update only that guest’s participant entry.
- `get_bill` reads the current bill through the plan-code capability.
- `save_bill` lets only the host capability replace bill items, rates, and initial claims.
- `set_bill_claim` lets a guest capability add or remove only that guest’s own claim.
- `set_plan_status` lets the host close a plan into read-only mode or reopen it.
- `extend_plan_expiry` renews host-controlled access for another 30 days.
- `delete_plan` permanently removes the plan and its cascading participants, bill, and claims.
- `set_plan_venue` stores the host's timestamped live venue so every guest sees the same place and provider status.
- `set_guest_payment_sent` lets a guest capability update only that guest's payment state.
- `set_host_payment_status` lets the host confirm or reset settlement for anyone in the plan.
- `set_plan_transport_modes` lets the host maintain getting-home choices for the group.
- `set_guest_transport_mode` lets a guest capability change only that guest's own choice.

## Apply the migration

1. Create a Supabase project.
2. Run every file in `supabase/migrations` in filename order in the Supabase SQL editor, or link a Supabase CLI project and run `supabase db push`.
3. Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the project Connect panel. `EXPO_PUBLIC_SUPABASE_ANON_KEY` remains as a legacy fallback.
4. Set `EXPO_PUBLIC_APP_URL` to the deployed web origin if the app has one.
5. Restart Expo so public environment variables are bundled.

The publishable key is designed for public clients. Never place a Supabase secret or service-role key in an `EXPO_PUBLIC_` variable or in the app bundle.

Plan codes are guest read capabilities and expire after 30 days. Hosts can renew access, close joining and claims while retaining a read-only view, or permanently delete the plan. Before a public launch, add gateway rate limits to the read RPCs and confirm the final retention policy.

Plan, participant, bill, and claim writes broadcast a data-free invalidation event to the public `plan:<code>` Realtime topic. Clients then reload data through capability-scoped RPCs; a 15-second polling fallback covers blocked or interrupted WebSocket connections. The event contains no participant, bill, or capability data.

Keep public Realtime channels enabled for push refresh. If a project disables them, the app remains functional through the polling fallback.

## Live venue search

The app calls the `venue-search` Edge Function, which keeps the Google Places key off the client. Configure and deploy it with:

```sh
supabase secrets set GOOGLE_MAPS_API_KEY=your_google_places_key
supabase functions deploy venue-search --no-verify-jwt
supabase functions deploy transit-routes --no-verify-jwt
supabase functions deploy drive-routes --no-verify-jwt
```

Enable Places API (New) and Routes API for that restricted key. The transit function asks Routes API for scheduled public-transport options arriving by 1:30 am Singapore time and returns timestamped route steps. These read-only functions are public so clients using either modern publishable keys or legacy anon keys can call them. The app bundle should contain only the Supabase URL and public key from `.env.example`; never add the Google key to an `EXPO_PUBLIC_` variable. Add gateway rate limits before public launch.

When the transit function is unavailable, the app deliberately falls back to its clearly labelled prototype schedule model.
