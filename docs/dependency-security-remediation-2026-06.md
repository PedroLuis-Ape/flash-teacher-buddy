# Dependency security remediation — June 2026

## Scope

The Lovable dependency scan reported 39 advisories concentrated in seven direct dependencies. This remediation separates runtime risk from development/build tooling and avoids a blanket `npm audit fix --force` upgrade.

## Changes

- Removed unused `vite-plugin-pwa`.
- Removed direct `uuid` and `@types/uuid`; the application uses `crypto.randomUUID()`.
- Updated `react-router-dom` to the patched v6 line.
- Updated `@supabase/supabase-js` to the current stable v2 line.
- Moved Vitest to `devDependencies` and updated it to the patched 4.1 line.
- Updated Vite to the patched 6.4 line.
- Pinned patched transitive versions for `ws`, `lodash`, and `rollup` through npm overrides.
- Added a dependency audit report and CI policy.
- Added Dependabot weekly update groups.

## CI policy

- Block any high or critical vulnerability in production dependencies.
- Block any critical vulnerability in the complete dependency tree.
- Report high vulnerabilities that are restricted to development tooling.
- Keep moderate findings visible without turning every transient ecosystem advisory into an emergency deployment blocker.

## Validation

The remediation must pass lockfile regeneration, clean install, production dependency audit, typecheck, tests, lint, production build, and the existing project security checks before merge.
