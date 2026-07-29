# Dependency security remediation — July 2026

## Scope

This change addresses the dependency findings reported by the Lovable security scan. It is intentionally separate from the database/RLS remediation and does not change Supabase configuration, migrations, application data, or deployment settings.

## Baseline

The clean dependency tree from `origin/main` reported:

- complete tree: 9 vulnerabilities — 1 low, 5 moderate, 3 high;
- production tree: 6 vulnerabilities — 1 low, 5 moderate;
- no critical vulnerabilities.

## Applied patches

- Updated PostCSS to `8.5.25`.
- Pinned `@hono/node-server` to `2.0.12`.
- Pinned `@modelcontextprotocol/sdk` to `1.30.0`.
- Updated the paired `minimatch`/`brace-expansion` toolchain to `10.2.6`/`5.0.8` so the security fix and runtime API remain compatible.
- Preserved the existing Vitest/Vite compatibility override.
- Added contract tests so a future lockfile refresh cannot silently restore the vulnerable versions.

## Result

Both the complete and production audits now report:

- 2 moderate vulnerabilities;
- 1 low vulnerability;
- 0 high or critical vulnerabilities.

The two residual reports belong to React Router 6.30.4. The application is a client-rendered SPA and does not use React Router's server-side hydration path, which limits one of the reported vectors. Navigation input must nevertheless remain internal and validated.

The automated major upgrade proposed by npm was not accepted. React Router 7.18.2 currently has a separate high-severity advisory, so changing major versions would add migration risk and would not produce a clean security result. The direct dependency remains pinned to 6.30.4 until a published version resolves the relevant advisories without introducing a high-severity finding.

The residual low finding is esbuild 0.27.7 inside the Lovable MCP toolchain and concerns a Windows development-server file-read path. A forced nested upgrade was tested and rejected because npm placed the overridden esbuild inside Vite 6, breaking the production build. The frontend does not expose that MCP development server in production; this finding remains visible until the Lovable MCP package publishes a compatible update.

## Rollback

This change is reversible by restoring `package.json` and `package-lock.json` together. It contains no database operation and no production write.

## Follow-up

1. Re-run `npm audit` when a newer React Router release is available.
2. Recheck the Lovable MCP package for an upstream esbuild update.
3. Upgrade React Router in a dedicated PR with routing regression tests.
4. Re-run the Lovable deep security scan after the dependency PR is merged and published through Lovable.
