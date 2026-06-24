# Dependency security remediation — June 2026

## Scope

The Lovable dependency scan reported 39 advisories concentrated in seven direct dependencies. This remediation separates runtime risk from development/build tooling and avoids a blanket `npm audit fix --force` upgrade.

## Changes

- Removed unused `vite-plugin-pwa`.
- Removed direct `uuid` and `@types/uuid`; the application uses `crypto.randomUUID()`.
- Updated `react-router-dom` to the patched v6 line.
- Updated `@supabase/supabase-js` to the current stable v2 line.
- Moved Vitest to `devDependencies` and updated it to the patched 4.1 line.
- Updated the application Vite toolchain to the patched 6.4 line.
- Pinned patched transitive versions for `ws`, `lodash`, and `rollup` through npm overrides.
- Applied all semver-compatible transitive fixes offered by npm.
- Standardized CI on Node.js 22, required by the updated Supabase Realtime client during Node-based tests.
- Added a dependency audit report and CI policy.
- Added Dependabot weekly update groups.

## Final audit

- Production dependency tree: 0 vulnerabilities.
- Complete tree: 2 development-only advisories, 0 critical.
- The two residual advisories are nested under Vitest: one low-severity esbuild development-server issue and one high-severity Vite development-server issue.
- The project does not run the Vitest UI or expose its development server in production; tests execute through `vitest run` in isolated CI.
- A forced nested Vite/esbuild override was rejected because it made the lockfile incompatible. It was intentionally not shipped.

## CI policy

- Block any high or critical vulnerability in production dependencies.
- Block any critical vulnerability in the complete dependency tree.
- Report high vulnerabilities that are restricted to development tooling.
- Keep development-only findings visible until an upstream-compatible Vitest release removes them.

## Validation

The remediation passed clean install, production dependency audit, typecheck, 718 tests, lint, production build, the folder glossary diagnostics, and the environment contract before merge.
