

## Plan: Student-Side Turma Flow Cleanup and Stabilization

### Problems Found

1. **Duplicate turma entry points on student home**: `TurmaShortcut` (highlighted cards with direct navigation) AND `TurmasCard` (generic card navigating to `/turmas`) both render for students. Redundant and confusing.

2. **Dead import**: `StudentClassShortcut` is imported in Index.tsx but never rendered.

3. **Dead-end turma cards in TurmasAluno**: Turma cards at `/turmas/aluno` are NOT clickable (no `onClick`, no `cursor-pointer`). Student sees turmas but cannot tap them.

4. **Points still visible in TurmasAluno**: `{atribuicao.pontos_vale} pontos` still shows despite being removed from TurmaDetail in a previous pass.

5. **Overlapping pages**: Students have three overlapping turma screens:
   - `/turmas` (Turmas page) — lists turma cards, clickable
   - `/turmas/aluno` (TurmasAluno page) — lists turma cards (not clickable) + assignments flat list
   - `/turmas/:turmaId` (TurmaDetail) — full detail with tabs including assignments

6. **Wasted network call**: `Turmas` page loads `useTurmasMine()` even for pure students.

---

### Changes

#### 1. `src/pages/Index.tsx`
- Remove the `StudentClassShortcut` import (dead import, never used in JSX).
- Remove the `TurmasCard` rendering for students (line 272: `{!isTeacher && <TurmasCard />`}). The `TurmaShortcut` component already provides a better, highlighted entry point. If the student has no turmas, `TurmaShortcut` hides itself, and the generic `TurmasCard` adds no value (it just takes student to an empty `/turmas` page anyway).

#### 2. `src/pages/TurmasAluno.tsx`
- Make turma cards clickable: add `onClick={() => navigate(\`/turmas/\${turma.id}\`)}` and `cursor-pointer` class.
- Remove points display from assignments (`{atribuicao.pontos_vale} pontos`).
- This page becomes a focused "all my turmas + all my assignments" overview, complementary to (not duplicating) TurmaDetail.

#### 3. `src/pages/Turmas.tsx`
- For non-teacher users, skip calling `useTurmasMine()` to avoid wasting a network call. Use conditional `enabled` or just render the student view directly using `useTurmasAsAluno`.

#### 4. `src/components/TurmaShortcut.tsx`
- For students with turmas, add a small "Ver todas" link that goes to `/turmas` (already exists for >3 turmas). No changes needed here; behavior is already correct.

#### 5. No changes to teacher-side
- `TurmasProfessor`, teacher shortcuts, `PainelProfessor`, teacher-side `TurmaDetail` tools — all left untouched.

---

### Summary of Student Flow After Changes

```text
Home → TurmaShortcut (highlighted, up to 3 turmas)
         ├─ Click turma → /turmas/:id (TurmaDetail with assignments, avisos, metas, messages)
         └─ "Ver todas" → /turmas (full list, clickable cards → /turmas/:id)

/turmas/aluno → also available, shows turmas (now clickable) + flat assignment list
```

- One clear primary path: Home → TurmaShortcut → TurmaDetail
- No dead-end cards anywhere
- No duplicate entry points on home
- Points removed from student assignment views
- Consistent clickable behavior across all turma card renderings

### Files to Change
- `src/pages/Index.tsx` — remove dead import, remove redundant TurmasCard for students
- `src/pages/TurmasAluno.tsx` — make turma cards clickable, remove points display
- `src/pages/Turmas.tsx` — skip teacher data loading for pure students

