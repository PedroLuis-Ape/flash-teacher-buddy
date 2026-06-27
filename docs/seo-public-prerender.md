# Public SEO prerender

The production build generates semantic HTML for these canonical public routes:

- `/`
- `/portal`
- `/ingles-para-iniciantes`
- `/atividades-de-ingles`
- `/flashcards-de-ingles`
- `/para-professores`
- `/about`

Source content lives in `config/public-seo-pages.json`.

Build order:

1. Vite produces the application bundle.
2. `scripts/prerender-public-pages.mjs` creates route-specific HTML files.
3. `scripts/validate-prerender.mjs` verifies titles, canonical URLs, H1 content, JSON-LD and the React bundle.
4. Hosting rules serve these files before the generic SPA fallback.

The static content is a crawlable first response. React still loads normally and replaces the root content for interactive use.
