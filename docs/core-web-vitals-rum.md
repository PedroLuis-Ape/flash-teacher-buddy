# Core Web Vitals RUM

Updated: 2026-07-13

## Purpose

APE collects sampled first-party field measurements for LCP, INP and CLS to identify normalized routes and device classes that need performance work. It is not a user-behavior analytics system.

## Thresholds

| Metric | Good | Needs improvement | Poor |
|---|---:|---:|---:|
| LCP | ≤ 2,500 ms | ≤ 4,000 ms | > 4,000 ms |
| INP | ≤ 200 ms | ≤ 500 ms | > 500 ms |
| CLS | ≤ 0.10 | ≤ 0.25 | > 0.25 |

Product-level evaluation uses the 75th percentile segmented by mobile, tablet and desktop. A single session value is diagnostic only.

## Data collected

Each row contains only:

- an ephemeral page-view UUID;
- metric, value and server-validated rating;
- normalized route group such as `/portal/list/:id`;
- coarse device class;
- navigation type;
- sampling rate;
- optional build identifier;
- server timestamp.

## Data excluded

The implementation does not accept or store account ID, email, name, raw URL, query string, search term, answer, study content, cross-session identifier, IP field or user-agent field. Dynamic values are replaced by placeholders; unknown paths become `/other`.

## Sampling and delivery

- observation runs in compatible browsers;
- network delivery occurs only on `www.apeeducation.org`;
- default sampling is 10%, configurable with `VITE_RUM_SAMPLE_RATE`;
- the session decision is retained in `sessionStorage`;
- delivery uses `sendBeacon` with a keepalive-fetch fallback;
- one page-view/metric pair is upserted;
- previews and noncanonical hosts do not send samples.

## Ingestion boundary

`/api/rum` is a Netlify Edge Function. It accepts only POST, limits bodies to 4 KB, applies a closed allowlist, recalculates ratings, validates ranges and normalized routes, and writes through a service-only RPC.

The function accepts only the official Supabase host:

`https://xrnfhhoxmmstagmelvyi.supabase.co`

It requires one server-scoped credential in Netlify:

- `SUPABASE_SERVICE_ROLE_KEY`; or
- `SUPABASE_SECRET_KEY`.

The credential must belong to `xrnfhhoxmmstagmelvyi`. It never enters the browser bundle.

## Database access

- `web_vital_samples` has RLS enabled;
- `anon` and `authenticated` have no table privileges;
- ingestion, aggregation and purge access are restricted to `service_role`;
- `web_vital_daily_summary` computes continuous p75 by day, metric, device and normalized route.

Operational dashboards should qualify low-volume segments. A practical initial rule is not to make route-level decisions from fewer than 75 observations in the selected period.

## Retention

`purge_web_vital_samples(retention_days)` accepts 7–730 days. The intended production retention is 90 days.

## Activation status

The database migration is installed in the official project. Production activation requires:

1. add the official service credential to Netlify with Functions scope;
2. deploy `main` containing the single-project runtime correction;
3. optionally set `VITE_RUM_SAMPLE_RATE`;
4. confirm samples through a service-only SQL session;
5. schedule `purge_web_vital_samples(90)`;
6. review p75 after enough samples accumulate.
