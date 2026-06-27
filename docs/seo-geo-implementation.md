# SEO/GEO implementation status

Updated: 2026-06-27

## Official backend

App Piteco uses Supabase project `xrnfhhoxmmstagmelvyi`.

Repository configuration, frontend initialization, database changes and documentation must remain aligned with this project.

## Completed foundation

- canonical crawler policy in `robots.txt`;
- canonical public routes in `sitemap.xml`;
- permanent `/landing` redirect;
- correct Portuguese document language;
- corrected organization and founder structured data;
- reusable page metadata controls;
- SEO consistency validation in CI.

## Current environment work

- `supabase/config.toml` uses the official project;
- versioned environment files were removed;
- the frontend obtains its public runtime settings from the official project;
- the bootstrap validates project identity before loading the application;
- CI validates runtime and optional deployment settings.

## Remaining work

1. Verify the runtime configuration endpoint.
2. Pre-render canonical public routes.
3. Generate a dynamic sitemap for public teachers and materials.
4. Return real HTTP 404 or 410 responses for missing public entities.
5. Expand structured entities for APE, Pedro, teachers and learning resources.
6. Publish first-party educational evidence and methodology pages.
7. Add real-user INP, LCP and CLS monitoring.
8. Add stable international URLs and `hreflang`.
9. Monitor AI citations and Share of Model.
