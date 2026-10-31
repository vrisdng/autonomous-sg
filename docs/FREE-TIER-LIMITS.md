# Pilot costs and limits

Checked 2026-09-15. Use free accounts only; no automatic paid upgrades.

| Service | What Bojio uses | Free allowance / limit |
| --- | --- | --- |
| Cloudflare Pages | Static Expo web build and a pages.dev address | Static requests free and unlimited; 500 Git builds/month, one concurrent build, 20-minute build timeout; 20,000 files/site, 25 MiB/file |
| Supabase | Shared plans, claims, payments, OneMap Edge Function | 500 MB database/project; 5 GB egress; 500,000 Edge Function invocations; 200 peak Realtime connections and 2 million messages/month; free projects pause after one week of inactivity |
| OneMap / SLA | Address search and scheduled/driving routes | Free-to-use APIs; token-authenticated workshop documentation describes 250 calls/minute. This is not an uptime guarantee; provider throttling can reject requests. |

Cloudflare's 100,000/day Workers/Pages Functions limit does not apply to static page requests. Bojio's backend runs on Supabase, not Cloudflare Functions, so Supabase and OneMap limits still apply when people use the app.

Bojio reserves a weighted provider budget before each batch: 160 units/minute per client and 200 globally, shared across Edge instances. Search reserves 4 units; a route batch reserves 3 units per journey plus 2 for initial authentication. This conservatively accounts for retries/token refresh rather than treating four journeys as one call. At most two journeys run concurrently per batch. These fixed-window application safeguards are not extra provider allowance or a guarantee against provider throttling (especially at window boundaries). Large groups or repeated comparisons may reach the limit; 429 responses remain retryable errors. API-key validation and quota checks also use backend resources.

Restaurant reviews/photos open on Google Maps through ordinary Maps URLs (no API key or billable Places API call). Bojio does not embed Google reviews or cache provider results persistently. Identical in-flight lookups can share work within an Edge instance; completed lookups are discarded.

A purchased custom domain is optional and not included; use the free pages.dev URL. No payment processing service is connected: “sent” and “received” are manual bill tracking.

Sources:
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/functions/pricing/
- https://supabase.com/pricing
- https://www.onemap.gov.sg/apidocs/static/media/OneMap_API_Workshop_Demo_260825.6522ddef4affd370a81a.pdf
