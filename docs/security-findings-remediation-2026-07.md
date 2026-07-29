# Security findings remediation — July 2026

## Scope

This change addresses the four database findings shown by the Lovable security
scanner without applying a remote migration or changing production data:

- unpublished store catalog rows readable without authentication;
- inert deny-all policies on legacy classroom tables;
- a conflicting inert policy on `class_members`;
- historical flashcard policies that bypass the current membership checks.

Dependency advisories are intentionally handled separately so that a frontend
upgrade cannot be confused with a database-policy change.

## Safety properties

- No row is deleted, archived, published, unpublished or rewritten.
- Anonymous catalog reads require an active, published item. The public
  projection additionally requires approval.
- Developer administrators can still review drafts.
- Users can still render catalog assets for items already in their inventory.
- Pending gift recipients can render the exact offered item.
- Removing a permissive `USING (false)` policy does not grant access: when no
  allow policy matches, PostgreSQL RLS remains default-deny.
- Anonymous public learning-list cards continue through
  `get_portal_flashcards(uuid)`.
- The only direct anonymous flashcard policy retained is for a genuinely public
  collection whose owner enabled public access. It cannot read class content.

## Required pre-deployment evidence

Do not apply the migration automatically. Before applying it to either project:

1. Confirm the target project ref and record `pg_policies` for the affected
   tables.
2. Confirm that active public catalog rows intended for sale have
   `status = 'published'`.
3. Run `supabase/tests/lovable_security_findings_rls_smoke.sql` in disposable or
   staging infrastructure.
4. Test anonymous, owner, unrelated authenticated user, class member, class
   outsider and developer-administrator access.
5. Test an archived owned item and a pending gift.
6. Apply only after a database backup or point-in-time restore checkpoint is
   available.

## Rollback

The preferred rollback is a new forward migration, not a schema reset. Restore
only the last known-good policy definitions captured in step 1. Never restore
the two overbroad historical flashcard policies. If storefront compatibility is
the problem, temporarily disable advanced catalog publication while preserving
the published-only boundary.
