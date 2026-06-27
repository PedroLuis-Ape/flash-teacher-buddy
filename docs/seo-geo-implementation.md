# SEO/GEO implementation status

Updated: 2026-06-27

## Environment gate

The repository, the versioned public frontend environment, and `supabase/config.toml`
all identify the documented production Supabase project as:

`ymahldldyxvwjeruaxpr`

The administrative Supabase connection available during this audit does not expose
that project. It exposes only a legacy inactive project and a separate newer project.
Therefore:

- frontend, documentation, tests, crawl controls, metadata and static public files may be changed;
- no migration, Edge Function deployment, RLS change or data write may be applied through
  the currently connected Supabase projects;
- backend implementation is unlocked only when the administrative connection exposes
  `ymahldldyxvwjeruaxpr`, or when a verified deployment migration changes the production ref.

This is a safety boundary, not an uncertainty about the project ref used by the current
versioned frontend.

## Phase 1 — crawl and metadata foundation

This branch implements the low-risk foundation:

- one canonical public discovery policy in `robots.txt`;
- removal of bot-specific groups that accidentally bypassed private-route exclusions;
- a sitemap containing only canonical public routes;
- permanent `/landing` → `/` redirect before the SPA fallback;
- Portuguese document language and corrected organization/founder entities;
- removal of the invalid public `SearchAction`;
- reusable robots directives, language, image alt text, localized alternates and safer JSON-LD serialization in `SEOHead`;
- an independent `scripts/validate-seo.mjs` consistency check;
- automatic execution of the SEO/GEO check in the pull-request CI workflow.

## Deliberate limits of this phase

- The SPA fallback can still return HTTP 200 before React determines that an unknown route
  is missing. A true HTTP 404 requires hosting or edge-level routing.
- Dynamic public teachers, classes and materials are not added to the sitemap until the
  documented production Supabase project is administratively available.
- Search and citation crawling remains allowed on public routes. This phase does not add
  a new policy for foundation-model training.
- International URLs and `hreflang` are supported by the metadata component but are not
  published until stable `/pt/` and `/en/` routes exist.
- The existing `llms.txt` remains unchanged in this branch because the connected write
  layer rejected automated modifications to that file. It must be revised separately so
  it no longer links to blocked product areas.
- The SEO validation script is not exposed as an npm alias because the connected write
  layer rejected automated `package.json` changes. CI runs it directly with
  `node scripts/validate-seo.mjs`.

## Next implementation phases

1. Pre-render or server-render the canonical static public routes.
2. Build a production-backed dynamic sitemap for published teachers and materials.
3. Return real 404/410 status codes for missing public entities.
4. Expand entity markup for APE, Pedro, teachers and learning resources.
5. Publish first-party, citation-worthy educational evidence and methodology pages.
6. Add Real User Monitoring for INP, LCP and CLS.
7. Introduce stable international URLs and `hreflang`.
8. Add recurring citation and Share-of-Model monitoring.
