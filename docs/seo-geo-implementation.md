# SEO/GEO implementation status

Updated: 2026-07-12

## Official backend

App Piteco uses Supabase project `xrnfhhoxmmstagmelvyi`.

Repository configuration, frontend initialization, database changes and documentation must remain aligned with this project.

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
- official bilingual source pages for product identity, authorship, methodology, privacy and citation wording;
- `Person`, `Organization`, `SoftwareApplication`, `AboutPage`, `FAQPage` and `BreadcrumbList` entities on the official sources;
- SEO consistency validation in CI.

## Current environment work

- `supabase/config.toml` uses the official project;
- versioned environment files were removed;
- the frontend obtains its public runtime settings from the official project;
- the bootstrap validates project identity before loading the application;
- CI validates runtime and optional deployment settings.

## Current canonical authority pages

- `/pt-br/fonte-oficial`;
- `/en/official-source`.

These pages are the preferred first-party sources for factual descriptions of APE / App Piteco. They are present in the sitemap, linked from `llms.txt`, paired with reciprocal `hreflang`, and emitted as static HTML during the production build.

## Remaining work

1. Generate a dynamic sitemap for public teachers and materials.
2. Return real HTTP 404 or 410 responses for missing public entities.
3. Publish deeper first-party methodology and educational evidence pages.
4. Add stable author/profile entities for public teachers and published learning resources.
5. Add real-user INP, LCP and CLS monitoring.
6. Expand international URLs beyond the current Portuguese and English foundation when content is ready.
7. Connect Search Console and Bing Webmaster monitoring to a recurring review process.
8. Monitor AI citations, brand mentions and Share of Model.
9. Build external authority through useful references, partnerships and legitimate backlinks.
