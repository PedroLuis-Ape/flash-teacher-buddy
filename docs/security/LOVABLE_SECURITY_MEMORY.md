# Security Memory v2 — App Piteco / APE Flashcards

**Purpose:** canonical security instructions for Lovable and any AI or developer changing this repository.

**Last organized:** 2026-06-24  
**Canonical repository:** `PedroLuis-Ape/flash-teacher-buddy`  
**Canonical production project ref documented by the repository:** `ymahldldyxvwjeruaxpr`

---

## 1. Environment identity comes first

Before changing SQL, RLS, grants, Edge Functions, secrets, storage policies, or production data, verify that the connected Supabase project is the canonical project used by the published frontend.

The repository and `supabase/config.toml` currently identify `ymahldldyxvwjeruaxpr` as production. Administrative connections to other project refs must not be treated as production merely because the schema or project name looks similar.

**Never apply backend changes to another project without verifiable evidence that the published app was migrated to it.** Follow `docs/environment-contract.md`.

This document defines security invariants and intended behavior. It does not prove that an unknown or inaccessible live database already matches them.

---

## 2. Trust boundaries

- The browser, URL parameters, local storage, imported files, AI-generated JSON, and every client-supplied ID are untrusted.
- Authorization must be enforced in PostgreSQL RLS, a carefully designed RPC, or a protected Edge Function—not only in React.
- Never trust a client-supplied `user_id`, `owner_id`, role, price, points total, class membership, or administrative flag. Resolve identity from `auth.uid()` or a verified JWT.
- The Supabase publishable/anon key in `VITE_*` variables is public by design. It is safe only because RLS and server authorization remain mandatory.
- Service-role keys, database passwords, JWT secrets, Management API tokens, private signing keys, and third-party secrets must never enter frontend code, committed `.env` files, logs, screenshots, or responses.

---

## 3. Access-control model

### Anonymous users

Anonymous users may access only explicitly public surfaces:

- public portal data through dedicated read-only RPCs such as `get_portal_folders`, `get_portal_lists`, `get_portal_flashcards`, and `get_public_profile`;
- the approved and published `public_catalog` surface;
- explicitly public health checks such as the `ping` Edge Function.

Portal RPCs must:

- return only teachers with `public_access_enabled = true`;
- exclude deleted content;
- exclude folders, lists, cards, assignments, and progress linked to turmas/classes;
- expose only the minimum safe columns;
- never expose email, private profile fields, membership records, student progress, or internal IDs that are not required by the public UI.

Direct anonymous table access is forbidden for private or class-scoped data. Do not broaden an RLS policy merely to make the public portal work; repair the dedicated public RPC instead.

### Authenticated students and teachers

Authenticated access is limited by one or more of these checks:

- row ownership through `auth.uid()`;
- turma/class membership through helpers such as `is_class_member` or `is_turma_member`;
- turma/class ownership through helpers such as `is_class_owner` or `is_turma_owner`;
- an explicit server-side workflow that validates the current user and the target resource.

Students must not gain access to another student’s progress, inventory, messages, notifications, private profile data, or personal study content.

Teachers may manage only their own content and classes, except for narrowly defined developer-admin operations.

### Developer administrators

Developer-admin abilities must be guarded by `is_developer_admin(auth.uid())` or an equally explicit server-side check. A frontend admin screen, route guard, hidden button, email comparison, or local role value is not authorization.

Developer-admin privileges must remain narrow and auditable, especially for store publishing, administrative catalogs, repairs, imports, and cross-user operations.

---

## 4. RLS and table grants

All exposed application tables must use RLS with least-privilege policies.

Required rules:

- Default to deny.
- Separate `SELECT`, `INSERT`, `UPDATE`, and `DELETE` when their authorization differs.
- Use both `USING` and `WITH CHECK` where relevant.
- Derive ownership from `auth.uid()` rather than trusting an ownership field supplied by the client.
- Do not add `TO anon` or `TO authenticated` grants as a shortcut around a broken workflow.
- A table with RLS enabled but no policy is intentionally inaccessible unless documented otherwise.
- Public visibility and class visibility are different concepts. Class-scoped content must always require authentication and verified membership/ownership.

Sensitive tables that must never become anonymously readable include, at minimum:

- `profiles`
- `app_config`
- `user_roles`
- `user_favorites`
- `user_red_list`
- `user_flashcard_group_status`
- `user_inventory`
- `notificacoes`
- `mensagens`
- class/turma membership and assignments
- student progress, answers, sessions, achievements, points, exchange logs, and purchase records

`profiles` may be readable by the owner under RLS, but public profile pages must use `get_safe_profile` / `get_public_profile` or an equivalent safe projection that excludes PII.

---

## 5. Protected write paths

The client must not directly perform privileged writes to:

- `profiles` fields that affect identity, public visibility, skins, balances, or protected settings;
- `user_inventory`;
- `notificacoes`;
- `user_roles` except the specifically allowed student signup path;
- points, PiTECoin balances, exchange records, purchases, gifts, rewards, or achievements;
- cross-user class/turma membership and progress records;
- administrative catalog or store publication state.

Use a SECURITY DEFINER RPC or protected Edge Function that validates the authenticated user, target resource, allowed fields, price/value, idempotency key, and authorization before writing.

Self-elevation is prohibited. Direct client role insertion may assign only `student`; teacher, moderator, admin, or developer-admin roles require a trusted server workflow.

---

## 6. SECURITY DEFINER RPC rules

A SECURITY DEFINER function is privileged code and must satisfy all of these rules:

1. Use a fixed `search_path` such as `SET search_path = public, pg_temp`.
2. Validate authentication with `auth.uid()` when the function is not intentionally public.
3. Validate ownership, membership, role, and resource state inside the function.
4. Never authorize from a client-supplied user ID alone.
5. Revoke default/public execution and grant `EXECUTE` only to the intended roles.
6. Return the minimum necessary columns.
7. Avoid dynamic SQL; if unavoidable, use safe identifier/literal handling.
8. Be idempotent for purchases, exchanges, imports, rewards, and other retryable operations.
9. Internal trigger helpers must not remain callable through the REST RPC surface.
10. Anonymous SECURITY DEFINER execution is allowed only for a documented, read-only public endpoint.

Do not flag the documented portal RPCs solely because anon `EXECUTE` is present. Do flag any other anonymous SECURITY DEFINER function unless its public purpose and returned data are explicitly documented.

---

## 7. Edge Functions

- Every function must have an explicit entry in `supabase/config.toml`.
- `verify_jwt = true` is the default for private functions.
- `verify_jwt = false` is allowed only for functions listed as intentionally public in `config/security-audit.json`.
- Functions using a service-role/admin client must call `auth.getUser()` and reject missing or invalid users before privileged work.
- Authentication alone is not enough: validate authorization for the requested turma, folder, list, assignment, store operation, or user.
- Never return internal errors, secrets, tokens, SQL details, or service-role responses to the browser.
- Apply request-size limits, schema validation, safe CORS, rate limiting where abuse is plausible, and idempotency for financial/gamification operations.

`npm run check:security` is a required CI gate and must not be bypassed.

---

## 8. Realtime

Realtime publication membership must be explicit and minimal.

- `profiles` and `notificacoes` are intentionally excluded from `supabase_realtime` because they contain sensitive per-user data.
- Do not add sensitive tables to Realtime simply to refresh the UI faster.
- Any published table must still have correct RLS and must not broadcast columns unnecessary to subscribers.
- Prefer scoped channels and server-filtered reads for personal notifications, messages, inventory, and progress.

---

## 9. Storage and uploaded/imported content

- Buckets are private by default.
- Public buckets are allowed only for intentionally public, non-sensitive assets.
- User uploads must be stored under paths tied to the authenticated owner and protected by storage RLS.
- Validate MIME type, extension, file size, and content expectations server-side when security matters.
- Imported JSON/CSV and AI-generated content are data, never code.
- Apply strict schemas and size/count limits before database writes.
- Never render imported HTML unsanitized, execute embedded scripts, evaluate expressions, or trust file-provided ownership/role fields.
- Large imports should be atomic or resumable and must report rejected rows without silently weakening validation.

---

## 10. Intentional public surface — do not flag by itself

The following are intentional when implemented exactly as documented:

- anon `EXECUTE` on the dedicated read-only portal RPCs;
- anon `SELECT` on approved/published rows of `public_catalog`;
- the public `ping` health-check function;
- the Supabase publishable/anon key in frontend `VITE_*` variables;
- public profile fields returned through a safe projection/RPC with PII excluded.

Intentional does not mean unrestricted. Each surface must remain minimal, filtered, read-only where applicable, and covered by tests.

---

## 11. Findings that must be treated as security bugs

Always investigate and normally block release for:

- direct anon access to private, class-scoped, or student-specific tables;
- class content accessible without authentication and membership/ownership checks;
- PII returned by a public endpoint;
- a SECURITY DEFINER function executable by broader roles than intended;
- an RPC that trusts a supplied user ID instead of `auth.uid()`;
- client-controlled prices, balances, roles, points, rewards, or inventory;
- service-role secrets in frontend code or committed files;
- direct client writes to protected tables;
- sensitive Realtime publication membership;
- public storage access to private user files;
- missing `search_path` on privileged SQL functions;
- permissive RLS such as unconditional access without a documented public reason;
- authorization implemented only in React.

---

## 12. Recent hardening and verification status

Repository migrations currently document these hardening decisions:

- `app_config` reads restricted to authenticated users;
- class-visibility branches for collections/flashcards require an authenticated user;
- `profiles` and `notificacoes` removed from Realtime publication;
- direct user-role insertion limited to the `student` role;
- public portal RPCs filter public-enabled teachers and exclude class assignments;
- environment validation blocks mismatched project refs and committed server secrets.

However, live-database verification remains separate from repository intent. Until administrative access to the canonical production project is available, do not state that a migration or policy is live merely because it exists in Git.

---

## 13. Required change checklist

Before merging a security-sensitive change:

1. Confirm the canonical project/environment.
2. Identify the actor: anon, student, teacher, owner, or developer admin.
3. Identify the exact rows and columns the actor may read/write.
4. Verify RLS and explicit grants.
5. Review SECURITY DEFINER execution grants and `search_path`.
6. Check for client-supplied identity, price, role, ownership, or balance.
7. Review Realtime and Storage impact.
8. Add negative tests proving forbidden access is denied.
9. Run `npm run check:environment`, `npm run check:security`, dependency audit, typecheck, tests, lint, and production build.
10. Document intentional public exceptions so future scanners do not “fix” them by breaking the product.

When security and convenience conflict, preserve the security boundary and repair the workflow properly. Do not solve access errors by making policies broadly public.
