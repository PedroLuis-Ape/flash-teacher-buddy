# Core Web Vitals RUM

Updated: 2026-07-13

## Purpose

APE collects sampled first-party field measurements for the current Core Web Vitals:

- LCP — Largest Contentful Paint;
- INP — Interaction to Next Paint;
- CLS — Cumulative Layout Shift.

The collector is designed to answer operational questions such as which normalized routes and device classes need performance work. It is not a user-behavior analytics system.

## Thresholds

The application and database use the current good / needs-improvement boundaries:

| Metric | Good | Needs improvement | Poor |
|---|---:|---:|---:|
| LCP | ≤ 2,500 ms | ≤ 4,000 ms | > 4,000 ms |
| INP | ≤ 200 ms | ≤ 500 ms | > 500 ms |
| CLS | ≤ 0.10 | ≤ 0.25 | > 0.25 |

Product-level evaluation must use the 75th percentile and must segment mobile, tablet and desktop observations. A single session value is only a diagnostic sample.

## Data collected

Each stored row contains only:

- an ephemeral random page-view UUID;
- metric name;
- metric value;
- server-validated rating;
- normalized route group, such as `/portal/list/:id`;
- coarse device class;
- navigation type;
- configured sampling rate;
- optional build identifier;
- server observation timestamp.

## Data intentionally excluded

The implementation does not store or accept:

- account or user ID;
- email address;
- name;
- IP address in the application database;
- user-agent string;
- full or raw URL;
- query string;
- folder, list, classroom or student UUID;
- search terms;
- card answers or study content;
- cross-session tracking identifier.

Unknown paths are grouped as `/other`. Dynamic route values are replaced by placeholders before any network request.

## Sampling and delivery

- Local observation runs in compatible browsers.
- Network delivery occurs only on `www.apeeducation.org` in production.
- The default sample rate is 10% and can be changed with `VITE_RUM_SAMPLE_RATE`.
- One sampling decision is retained in `sessionStorage` for the current browser session.
- Metrics are sent with `sendBeacon` when possible and `fetch(..., keepalive: true)` as a fallback.
- The same page-view UUID and metric are upserted, preventing periodic and page-hide flushes from creating duplicate rows.
- Preview, development and noncanonical hosts do not send samples.

## Browser observer

The browser collector uses native Performance Observer entries:

- `largest-contentful-paint` for LCP;
- `layout-shift` with the standard session-window accumulation for CLS;
- `event` entries grouped by `interactionId` for an INP field estimate.

The native INP observer is intended for first-party operational monitoring. CrUX and the official `web-vitals` implementation remain the external reference when exact ecosystem parity is required.

## Ingestion boundary

`/api/rum` is a Netlify Edge Function. It:

1. accepts POST requests only;
2. accepts the canonical production hostname only;
3. limits the request body to 4 KB;
4. rejects every field outside a closed allowlist;
5. recalculates the rating;
6. validates metric ranges, route safety and coarse enums;
7. uses a server-only Supabase service credential;
8. writes through a service-only PostgreSQL RPC;
9. returns an empty response and never blocks the application when storage is unavailable.

The Edge Function requires one of these function-scoped secrets:

- `SUPABASE_SERVICE_ROLE_KEY`; or
- `SUPABASE_SECRET_KEY`.

It also validates that the configured Supabase URL is the production data project `ymahldldyxvwjeruaxpr`.

## Database access

- `web_vital_samples` has RLS enabled.
- `anon` and `authenticated` have no table privileges.
- The ingestion RPC is executable only by `service_role`.
- The daily aggregate view is readable only by `service_role`.
- The purge RPC is executable only by `service_role`.

## Aggregation

`web_vital_daily_summary` groups by:

- day;
- metric;
- device class;
- normalized route group.

It exposes:

- sample count;
- continuous p75 value;
- proportion rated good;
- minimum and maximum.

Operational dashboards should suppress or clearly qualify segments with low sample counts. A practical initial rule is not to make route-level decisions from fewer than 75 observations in the selected period.

## Retention

`purge_web_vital_samples(retention_days)` supports retention from 7 to 730 days. The intended default is 90 days. Production should schedule the purge after the real data backend receives the migration.

## Activation checklist

1. Apply `20260713160000_core_web_vitals_rum.sql` to `ymahldldyxvwjeruaxpr`.
2. Add the correct service credential to Netlify with Functions scope.
3. Confirm `VITE_SUPABASE_URL` or `SUPABASE_URL` points to `ymahldldyxvwjeruaxpr`.
4. Deploy `main`.
5. Visit the canonical production site and allow the tab to become hidden or wait for a periodic flush.
6. Confirm rows appear through a service-only SQL session.
7. Schedule 90-day retention.
8. Review p75 by device class after sufficient samples have accumulated.
