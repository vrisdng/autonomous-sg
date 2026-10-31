# Free pilot setup

No paid upgrade or payment-card setup is required by this runbook. Stop if a service asks for a paid plan.

## 1. Supabase

Create a Free project in the Singapore region at https://supabase.com/dashboard. Keep the database password in your password manager, not in chat or the repository.

Once the project is ready, put its public configuration in `.env.local`:

```
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_KEY
```

Leave the existing `EXPO_PUBLIC_TRAVEL_API_URL` line for local preview. Production builds ignore this development override.

In SQL Editor, run all nine `supabase/migrations/*.sql` files in filename order. Alternatively, authenticate the Supabase CLI, link your project, and run `supabase db push`.

Deploy `onemap` with `supabase functions deploy onemap --no-verify-jwt`. The function's database quota guard must be deployed too (last migration). The service-role key is provided by Supabase to its own Edge Functions; never copy it into the web app.

## 2. OneMap

Register and verify your email at https://www.onemap.gov.sg/apidocs/register.

In Supabase → Edge Functions → Secrets, add `ONEMAP_EMAIL` and `ONEMAP_PASSWORD`. The server generates and renews its token. Do not add these to `EXPO_PUBLIC_*` variables.

For a short test, `ONEMAP_ACCESS_TOKEN` is supported instead. It expires and cannot renew itself. Replace any token previously pasted into chat before public release.

For local testing, copy `.env.server.example` to `.env.server`, enter credentials locally, and run `npm run dev:travel`. This file is ignored by Git. The gateway only listens on loopback port 8788.

OneMap Search and driving calls were verified with a real token on 2026-09-15. Transit calls returned walking-only itineraries or rail errors in the tested examples. The app rejects walking-only fallback as transit; scheduled transit is **not yet live-verified**.

## 3. Cloudflare Pages

Create a free Pages project and connect EurekaWN/bojio. Use build command `npm ci && npm run build:web`, output directory `dist`, Node 24, and the two public Supabase variables above. Select the free `pages.dev` hostname.

Do not configure `EXPO_PUBLIC_TRAVEL_API_URL` on Pages. Do not upload `.env.server`. Put `EXPO_PUBLIC_APP_URL=https://YOUR_PROJECT.pages.dev` in the Pages build variables and redeploy. Invitation URLs use `/plan/CODE`; Cloudflare Pages' SPA fallback should serve the app for these paths.

## Release checks

- Run `npm run typecheck`, `npm test`, `npm run test:database`, and `npm run build:web`.
- `npm run test:preview` uses a fresh headless Edge session and the real local OneMap gateway. It creates test people only in the isolated browser context.
- On the deployed URL, use two separate browser sessions: publish, join, update travel choice, save a venue, add and claim food, mark sent, confirm received, then refresh both.
- Test a missing provider result, expired token, offline save, and conflicting host/guest updates. Check there is no fallback fabricated time or fare.
- Verify three actual transit itineraries (west, centre, east) with valid boarding steps before marking scheduled transit complete.
- Check server logs for repeated quota/auth failures. A free Supabase project may pause after inactivity.

Local PostgreSQL checks stub only the Supabase Realtime transport. They are not evidence that the cloud project, public URL, or cross-device flow is deployed.
