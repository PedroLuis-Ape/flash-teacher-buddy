# SEO/GEO implementation status

Updated: 2026-07-13

## Backend architecture

APE uses one official Supabase project for authentication, runtime data, public discovery, HTTP status checks and RUM:

`xrnfhhoxmmstagmelvyi`

Frontend initialization, build-time discovery and Netlify Edge Functions reject a different Supabase project. The browser obtains the public configuration from environment variables or from `app-public-config` in the official project before importing the application.

## Completed foundation

- canonical crawler policy in `robots.txt`;
- canonical public routes in `sitemap.xml`;
- permanent `/landing` redirect;
- correct Portuguese document language;
- reusable page metadata controls;
- corrected organization and founder structured data;
- localized Portuguese and English public routes with reciprocal `hreflang`;
- build-time pre-rendering for canonical public routes;
- validation of canonical, language, alternate links and static HTML in CI;
- `llms.txt` with public/private discovery boundaries;
- official bilingual source pages for product identity, authorship, privacy and citation wording;
- bilingual methodology and evidence pages with explicit research limits and DOI-linked references;
- `Person`, `Organization`, `SoftwareApplication`, `Article`, `ScholarlyArticle`, `FAQPage` and breadcrumb structured data;
- build-time discovery and pre-rendering of public teacher profiles;
- build-time discovery and pre-rendering of public folders and individual public lists;
- dynamic public URLs appended to the deployed sitemap;
- `ProfilePage`, `CollectionPage`, `LearningResource`, `ItemList` and `BreadcrumbList` entities;
- visible authorship, languages, counts and revision dates in static HTML;
- client-side canonical metadata during internal navigation;
- `noindex` protection for missing, private or unavailable public entities;
- strict anonymous RPC boundaries for profiles, folders, lists and cards intentionally published outside classroom context;
- privacy-safe publication registry for teachers, folders and lists;
- real HTTP `404 Not Found` for keys with no publication history;
- real HTTP `410 Gone` for withdrawn public URLs;
- first-party sampled LCP, INP and CLS monitoring with normalized routes and no user identifiers;
- service-only p75 aggregation and retention controls;
- SEO, runtime, privacy and database smoke validation in CI.

## Evidence claim boundary

The evidence pages distinguish:

1. evidence about general learning principles;
2. implementation of related opportunities in APE features;
3. product-specific causal effectiveness.

Current public claims are limited to the first two layers. APE does not claim guaranteed learning, superiority over competitors or a product-specific causal effect without a dedicated evaluation.

## HTTP status semantics

- `200`: the profile, folder or list is currently public;
- `404`: the key has no recorded publication history;
- `410`: the exact URL was previously public and was withdrawn;
- temporary network or RPC failure: the edge layer bypasses interception instead of creating a false error.

Private entities that were never published remain indistinguishable from unknown identifiers.

## Current environment

- `supabase/config.toml` points to `xrnfhhoxmmstagmelvyi`;
- the frontend installs and validates the official runtime before importing the application;
- public-directory, folder and list builds use the same official runtime;
- HTTP-status and RUM Edge Functions validate the same project;
- MCP OAuth uses the official issuer;
- CI rejects the former split-project constants and any active reference to a different runtime project.

## Current canonical authority pages

- `/pt-br/fonte-oficial` and `/en/official-source`;
- `/pt-br/metodologia` and `/en/methodology`;
- `/pt-br/evidencias` and `/en/evidence`;
- `/portal/professor/:public_slug`;
- `/portal/folder/:folder_id`;
- `/portal/list/:list_id`.

## Remaining work

1. Rebuild and validate the complete classroom schema in the official project.
2. Connect Google Search Console and Bing Webmaster monitoring.
3. Monitor AI citations, brand mentions and Share of Model.
4. Expand useful international content when editorially ready.
5. Build external authority through legitimate references, partnerships and backlinks.
6. Design a product-specific evaluation protocol before making causal effectiveness claims.
