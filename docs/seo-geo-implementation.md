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
- build-time discovery and pre-rendering of public folders;
- dynamic learning-resource URLs appended to the deployed sitemap;
- `CollectionPage`, `LearningResource`, `Person`, `ItemList` and `BreadcrumbList` entities for public folders;
- visible authorship, languages, counts and update dates in static public-folder HTML;
- client-side canonical metadata when navigating to a public folder without a page reload;
- `noindex` protection for removed, private or unavailable public folders;
- anonymous portal RPCs restricted to folders, lists and cards explicitly marked public and outside classroom context;
- SEO consistency validation in CI.

## Current environment work

- `supabase/config.toml` uses the managed project;
- versioned environment files were removed;
- the frontend validates and selects the production data backend;
- the public-directory and learning-resource builds follow the same production-data validation;
- the bootstrap validates project identity before loading the application;
- CI validates runtime and optional deployment settings.

## Current canonical authority pages

- `/pt-br/fonte-oficial`;
- `/en/official-source`;
- `/portal/professor/:public_slug` for explicitly public teacher profiles;
- `/portal/folder/:folder_id` for teacher-owned folders intentionally published outside classroom context.

The bilingual official pages are the preferred first-party sources for factual descriptions of APE / App Piteco. Public teacher profiles are canonical sources for teacher identity and declared specialties. Public folders are canonical sources for the learning materials, languages, list structure and authorship intentionally published by that teacher.

## Remaining work

1. Return real HTTP 404 or 410 responses for missing public entities.
2. Publish deeper first-party methodology and educational evidence pages.
3. Add canonical indexable pages for individual public lists when editorially useful.
4. Add real-user INP, LCP and CLS monitoring.
5. Expand international URLs beyond the current Portuguese and English foundation when content is ready.
6. Connect Search Console and Bing Webmaster monitoring to a recurring review process.
7. Monitor AI citations, brand mentions and Share of Model.
8. Build external authority through useful references, partnerships and legitimate backlinks.
