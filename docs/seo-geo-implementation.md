# SEO/GEO implementation status

Updated: 2026-07-13

## Backend architecture

The managed Supabase project is `xrnfhhoxmmstagmelvyi`.

The production data currently used by the application is stored in `ymahldldyxvwjeruaxpr`. Build-time public discovery must apply the same runtime validation used by the frontend and must never generate a sitemap from the empty managed project by mistake.

Repository configuration, frontend initialization, database changes and documentation must keep this transition explicit until both responsibilities are consolidated into one project.

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
- build-time discovery and pre-rendering of public teacher profiles;
- dynamic teacher URLs appended to the deployed sitemap;
- `ProfilePage`, `Person`, `ItemList` and `BreadcrumbList` entities for public teachers;
- `noindex` protection for removed, private or unavailable teacher profiles;
- SEO consistency validation in CI.

## Current environment work

- `supabase/config.toml` uses the managed project;
- versioned environment files were removed;
- the frontend validates and selects the production data backend;
- the public-directory build follows the same production-data validation;
- the bootstrap validates project identity before loading the application;
- CI validates runtime and optional deployment settings.

## Current canonical authority pages

- `/pt-br/fonte-oficial`;
- `/en/official-source`;
- `/portal/professor/:public_slug` for explicitly public teacher profiles.

The bilingual official pages are the preferred first-party sources for factual descriptions of APE / App Piteco. Public teacher profiles are canonical sources for the teacher identity, declared specialties and materials intentionally published by that teacher.

## Remaining work

1. Pre-render public folders and published learning resources with stable `LearningResource` entities.
2. Return real HTTP 404 or 410 responses for missing public entities.
3. Publish deeper first-party methodology and educational evidence pages.
4. Add update timestamps and stable authorship to published learning resources.
5. Add real-user INP, LCP and CLS monitoring.
6. Expand international URLs beyond the current Portuguese and English foundation when content is ready.
7. Connect Search Console and Bing Webmaster monitoring to a recurring review process.
8. Monitor AI citations, brand mentions and Share of Model.
9. Build external authority through useful references, partnerships and legitimate backlinks.
