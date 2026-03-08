

# Plan: Index-Based Manual Word Hint Binding

## Problem
Current word hints use regex text matching which is fragile -- fails with repeated words, partial matches, and ambiguity. The user wants explicit manual selection of text ranges with `startIndex`/`endIndex`.

## Data Structure Change

Extend `WordHint` interface (backward compatible):

```ts
interface WordHint {
  text: string;           // kept for display + backward compat
  translation: string;
  note?: string;
  startIndex?: number;    // NEW — char position in source text
  endIndex?: number;      // NEW — char position end (exclusive)
}
```

Old hints without indices → fall back to current regex matching. New hints with indices → use exact position. No DB migration needed (JSONB field accepts any shape).

## Changes

### 1. `src/features/study/lib/wordHints.ts`
- Add `startIndex`/`endIndex` to `WordHint` interface
- Add new `segmentTextByIndex()` function that slices text by index ranges (no regex)
- Update `segmentText()`: if ALL hints have valid indices, use `segmentTextByIndex()`; otherwise fall back to regex
- Add `validateHintIndices(text, hints)` — returns which hints are stale after text edit
- Add `revalidateHints(newText, hints)` — tries to re-match stale hints by text, marks invalid ones

### 2. `src/features/study/components/WordHintEditor.tsx` — Full rebuild
Replace manual text input with text-selection UI:
- Show the source phrase (term) in a selectable preview area
- User selects text range → popover appears to enter translation + note
- Already-bound ranges shown with highlight (gold/amber underline)
- Each hint shows in a list below with edit/delete buttons
- On phrase text change: call `validateHintIndices()`, show warning banner for stale hints with "Revalidar" button

Props change: add `sourceText: string` prop (the term/phrase to select from)

### 3. `src/components/EditFlashcardDialog.tsx`
- Pass `sourceText={term}` to `WordHintEditor`
- On term change, trigger hint validation (visual warning if hints become stale)

### 4. `src/components/CreateFlashcardForm.tsx`
- Pass `sourceText={term}` to `WordHintEditor`

### 5. `src/features/study/components/InteractiveText.tsx`
- No interface change needed — it already calls `segmentText()` which will auto-detect index vs regex mode

### 6. All study views (Flip, Write, MC, Unscramble, Pronunciation)
- No changes needed — they already pass `wordHints` to `InteractiveText`

### 7. `src/features/study/lib/wordHints.test.ts` — New tests
- Index-based segmentation with exact positions
- Same word repeated twice at different positions → correct individual binding
- Stale index detection after text edit
- Backward compat: old hints without indices still work via regex
- Mixed hints (some with indices, some without) → graceful handling

## Text Selection UI Flow

```
┌─────────────────────────────────────────────┐
│  "I am going to the market"                 │  ← selectable text
│       ^^^^^^^^                              │  ← user selects "am going"
└─────────────────────────────────────────────┘
         ↓ popover appears
    ┌──────────────────┐
    │ Tradução:        │
    │ [estou indo    ] │
    │ Nota (opcional): │
    │ [             ]  │
    │ [Salvar]         │
    └──────────────────┘

Bound hints list:
  "am going" → estou indo  [✏️] [🗑️]
  "market"   → mercado     [✏️] [🗑️]
```

## Backward Compatibility
- Old hints `{text, translation}` without indices → regex matching (unchanged)
- New hints `{text, translation, startIndex, endIndex}` → exact index matching
- No DB migration — JSONB accepts both shapes
- Cards without any hints → plain text (unchanged)

## Files Summary

| File | Action |
|---|---|
| `src/features/study/lib/wordHints.ts` | Add index types + `segmentTextByIndex` + validation |
| `src/features/study/components/WordHintEditor.tsx` | Rebuild with text-selection UI |
| `src/features/study/components/InteractiveText.tsx` | Minor — uses updated `segmentText` |
| `src/components/EditFlashcardDialog.tsx` | Pass `sourceText` to editor |
| `src/components/CreateFlashcardForm.tsx` | Pass `sourceText` to editor |
| `src/features/study/lib/wordHints.test.ts` | Add index-based tests |

