# Public classes — production status

Verified on 20 June 2026.

## Production source of truth

The JavaScript bundle served by `https://www.apeeducation.org` references the Supabase project:

`ymahldldyxvwjeruaxpr`

The active project currently available to the automation tools, `xrnfhhoxmmstagmelvyi`, contains the reconstructed import core but does not contain the complete classroom schema (`profiles`, `turmas`, `turma_membros`, `atribuicoes` and the public classroom views). It must not be used as a substitute deployment target for this rollout.

## Code prepared in this rollout

- classroom updates use the authenticated `turmas-update` Edge Function;
- the Edge Function validates ownership and returns structured error codes;
- missing `turmas.public` schema is reported explicitly;
- the public teacher profile no longer uses demonstration data;
- real public classrooms are loaded through `get_public_teacher_turmas`;
- the new RPC exposes only public metadata and aggregate counts;
- automated typecheck, tests, lint and production build pass.

## Required production deployment order

After project `ymahldldyxvwjeruaxpr` is connected to the Supabase tooling:

1. Create a database backup or snapshot.
2. Confirm the presence of `profiles`, `turmas`, `turma_membros`, `atribuicoes`, `folders`, `lists` and `flashcards`.
3. Apply the following migrations in order, skipping only versions already present in the migration history:
   - `20260616143000_add_public_turmas.sql`
   - `20260616192000_public_teacher_directory.sql`
   - `20260616192500_fix_public_teacher_profile_lookup.sql`
   - `20260616195500_public_teacher_profile_settings.sql`
   - `20260620010000_public_teacher_turmas.sql`
4. Validate the public views, RPCs and grants for `anon` and `authenticated`.
5. Deploy `turmas-create` and `turmas-update` to the same project.
6. Merge the application pull request into `main`.
7. Publish the Lovable deployment.
8. Run authenticated and anonymous smoke tests on the production domain.

## Mandatory smoke tests

- owner publishes and privatizes a classroom, with persistence after reload;
- enrolled student retains the complete private view;
- authenticated non-member receives read-only public access;
- anonymous visitor receives read-only access plus account CTAs;
- private classroom reveals no metadata;
- disabling public access invalidates the shared link;
- public teacher profile lists the real public classroom and aggregate counts.

## Current external blocker

The automation account does not currently have access to Supabase project `ymahldldyxvwjeruaxpr`. Until that project is connected, database migrations, Edge Function deployment and production smoke tests cannot be performed safely. Applying them to another project would not affect the live application and could create a divergent environment.
