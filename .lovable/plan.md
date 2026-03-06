

## Plan: Scrolling Title Enhancement + Security Fixes

### Part A — Enhanced ScrollingTitle Component

**Current state:** `src/components/ui/scrolling-title.tsx` exists but is basic — always animates when overflowing, no mobile/desktop distinction, no `prefers-reduced-motion`, no IntersectionObserver.

**Changes to `src/components/ui/scrolling-title.tsx`:**
- Add `IntersectionObserver` so animation only runs when visible
- Add `useIsMobile()` hook: on mobile, auto-scroll when visible; on desktop, scroll only on hover/focus
- Respect `prefers-reduced-motion`: if enabled, show ellipsis + `title` attribute (tooltip), no animation
- Use CSS `animation-play-state` for pause control instead of React state toggling
- Initial state: 1 line with ellipsis (`truncate`); animation activates per rules above

**Apply to (3 files, surgical edits):**

| File | Where | Risk |
|------|-------|------|
| `src/components/ape/ApeCardFolder.tsx` | Replace `<h3 className="ape-card-title">{title}</h3>` with `<ScrollingTitle>` | Low |
| `src/components/ape/ApeCardList.tsx` | Replace `<h3 className="ape-card-title">{title}</h3>` with `<ScrollingTitle>` | Low |
| `src/pages/Folder.tsx` line ~874 | Replace `<h3 className="font-semibold text-sm truncate">{list.title}</h3>` with `<ScrollingTitle>` | Low |

**CSS (`src/index.css`):** Update `@keyframes marquee` to include start/end pause (e.g., 10% hold, 80% scroll, 10% hold).

---

### Part B — Security (warn-level findings only)

**Scan results:**

| ID | Level | Action |
|----|-------|--------|
| `SUPA_auth_leaked_password_protection` | **warn** | Cannot fix via code — requires manual toggle in Auth settings. Will note to user. |
| `PUBLIC_USER_INVENTORY` | error | **SKIP** (user instruction: ignore non-warn) |
| `PUBLIC_CATALOG_DATA` | **warn** | Fix: tighten RLS SELECT policy to filter `approved = true` for non-admin users |

**Migration for `public_catalog`:**
```sql
DROP POLICY IF EXISTS "Anyone can view active catalog items" ON public.public_catalog;

CREATE POLICY "Anyone can view active approved catalog items"
ON public.public_catalog
FOR SELECT
USING (is_active = true AND approved = true);
```
Risk: Low — only hides unapproved items from public view. Admin functions use service role key (bypasses RLS).

---

### Implementation Order
1. Enhance `ScrollingTitle` component
2. Update marquee keyframes in `index.css`
3. Apply `ScrollingTitle` to ApeCardFolder, ApeCardList, Folder.tsx
4. Run SQL migration for `public_catalog` RLS
5. Mark security findings as resolved

### Validation
- Long folder/list names scroll on mobile, hover-scroll on desktop
- `prefers-reduced-motion` shows tooltip instead of animation
- Store page still shows only active+approved items
- No layout overflow on any screen

