# Public classes — production status

Verified on 20 June 2026.

## Production source of truth

The application served by `https://www.apeeducation.org` uses Lovable Cloud project `ymahldldyxvwjeruaxpr`.

Project `xrnfhhoxmmstagmelvyi` was not used for this rollout.

## Backend deployment completed

Lovable Cloud reported the following migrations applied successfully:

- `20260616143000_add_public_turmas.sql`
- `20260616192000_public_teacher_directory.sql`
- `20260616192500_fix_public_teacher_profile_lookup.sql`
- `20260616195500_public_teacher_profile_settings.sql`
- the generated production migration containing `get_public_teacher_turmas`
- a defense-in-depth patch revoking anonymous execution of authenticated owner RPCs

The deployment added:

- `turmas.public` with default `false`;
- the four narrow public classroom views;
- public teacher directory RPCs;
- authenticated owner settings RPCs;
- `get_public_teacher_turmas`;
- grants required by `anon` and `authenticated` without granting anonymous mutation access.

## Edge Functions

- `turmas-create` was confirmed identical to the prepared version and redeployed;
- `turmas-update` was deployed with authentication, ownership validation, structured errors and persistence confirmation.

## Automated backend smoke tests

Lovable Cloud reported:

- anonymous reading of `public_turmas` returns `200`;
- anonymous execution of `get_public_teacher_turmas` returns `200`;
- direct anonymous reading of raw `turmas` reveals no rows because of RLS;
- anonymous execution of `update_public_teacher_settings` returns `401`;
- invalid tokens sent to `turmas-update` return structured `UNAUTHENTICATED` errors.

## Frontend rollout

The frontend branch is based on the Lovable-generated production migration commits and adds:

- updates through the deployed `turmas-update` function instead of direct browser writes;
- structured error handling;
- cache invalidation for private and public classroom queries;
- removal of demonstration teacher profile data;
- real public classroom cards on the public teacher profile;
- regression tests.

## Remaining manual smoke tests after publication

- owner publishes and privatizes a classroom, with persistence after reload;
- enrolled student retains the complete private view;
- authenticated non-member receives read-only public access;
- anonymous visitor receives read-only access plus account CTAs;
- private classroom reveals no metadata;
- disabling public access invalidates the shared link;
- public teacher profile lists the real classroom and aggregate counts.

## Rollback

- revert the frontend merge or republish the previous production commit;
- set affected classrooms to `public = false` if immediate exposure must be disabled;
- prefer corrective migrations instead of dropping production columns or views.
