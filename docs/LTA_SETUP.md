# LTA access verification — authentication resolved

Latest: 16 September 2026, 20:36 SGT. User corrected the server secret. Live checks now PASS: bus arrivals at stop 83139 returned three services and parsed arrival timestamps; BusRoutes returned 500 records; train schedule/disruption endpoints returned HTTPS download links. Real train envelopes use lowercase `timestamp`/`link`, unlike the guide's `Link` spelling. The adapter supports both without exposing signed URLs. `lta` Edge Function v5 is deployed. `verify-live-lta.mjs` now requires train links as well as HTTP success and verifies normalized bus-arrival timestamps. Train archive contents, schedule coverage, live MRT predictions and chained last-journey logic are NOT verified or connected to the frontend yet. Previous authentication failure below is historical.

16 September 2026, 20:27 Singapore time. Supabase `lta` Edge Function v2 reads `LTA_DATAMALL_ACCOUNT_KEY` only on the server. Its presence is confirmed without exposing the value. Trimming whitespace did not resolve access: all four live probes returned HTTP 401.

Verified endpoint definitions from LTA API Guide v6.9 (3 August 2026):

- `v3/BusArrival?BusStopCode=83139`
- `BusRoutes`
- `GTFSScheduleTrain`
- `GTFSRealtimeTrainTripUpdates`

Base: `https://datamall2.mytransport.sg/ltaodataservice/`. Authentication uses the `AccountKey` header. Source: https://datamall.lta.gov.sg/content/dam/datamall/datasets/LTA_DataMall_API_User_Guide.pdf (pages 13–14, 55–57).

Ask the owner to confirm the actual AccountKey from the approved LTA email and account activation, then update the Supabase secret directly. Never ask for the key in chat. Run `node --env-file=.env.local scripts/verify-live-lta.mjs` once after correction; this makes four bounded provider requests. It outputs only availability/timings/counts, not credentials or signed download URLs. A successful HTTP response still requires payload/coverage verification before UI integration.

No frontend change or last-service algorithm shipped in this checkpoint. The bus-arrival adapter exists but has not been validated against a successful real provider payload. Empty arrivals must never mean that the last service has gone. Train trip updates are explicitly documented as disruption-related; do not promise everyday live MRT predictions from that feed. Last-call planning must validate the complete route/transfer chain, service calendar and midnight boundary, not independently combine terminal departure times.
