

## Plan: 4-Part Language Direction System for Lists + Glossary

The PDF describes 4 sequential prompts. The good news: **Prompt 1 is already done** — `lang_a` and `lang_b` already exist on both `folders` and `lists` tables, the `ListStudyTypeSelector` already lets users pick languages with dropdowns, and `listRowToSettings` already handles fallbacks for old lists. So we skip straight to the actual gaps.

### What Already Exists
- `lists.lang_a`, `lists.lang_b` columns with defaults `'en'` / `'pt'`
- `ListStudyTypeSelector` with 12+ language dropdowns + swap + custom
- Settings dialog in ListDetail that saves `lang_a`/`lang_b`
- `glossaryMerge.ts` merges global glossary with manual hints by `side` field
- `BulkImportDialog` + `bulkImport.ts` parse `=== GLOSSÁRIO GLOBAL ===` sections
- `AI_HELPER_PROMPT` constant in `bulkImport.ts`

### What's Missing (the actual work)

---

**1. Glossary direction driven by list languages (Prompt 2)**

Currently, glossary entries are inserted with `side: "A"` hardcoded. The `mergeGlossaryAndManual` function filters by `g.side !== side`, which means glossary only shows on side A text. This is wrong for bidirectional use.

**Changes:**
- **`glossaryMerge.ts`** — Update `mergeGlossaryAndManual` to accept `primaryLang` and `secondaryLang` params from the list. When `side === "A"`, the `original_text` is in the primary language; when rendering side B text, match `translated_text` instead. Add a new overload or parameter so the function knows the list's language direction.
- **`Study.tsx`** — Pass `langA`/`langB` from `listSettings` into the merge logic so glossary knows the list's direction.
- **All study views** already receive `mergedHints` — no changes needed there.
- **Fallback**: If `lang_a`/`lang_b` are not set, keep current behavior (side A = original).

---

**2. AI Helper Prompt uses list languages (Prompt 3)**

Currently `AI_HELPER_PROMPT` is a static string that says generic "LADO A / LADO B".

**Changes:**
- **`bulkImport.ts`** — Convert `AI_HELPER_PROMPT` from a constant to a function `buildAIHelperPrompt(langA?: string, langB?: string)` that injects the list's primary/secondary language names into the prompt text, making the glossary direction explicit (e.g., "o glossário deve ser francês → inglês").
- **`BulkImportDialog.tsx`** — Accept `langA`/`langB` codes, call the new function, display the dynamic prompt. Already receives `labelA`/`labelB` — we'll also pass the raw codes.
- **`ListDetail.tsx`** — Pass `list.lang_a` and `list.lang_b` to `BulkImportDialog`.
- **Fallback**: If no languages defined, use generic "Lado A / Lado B" as today.

---

**3. Importer uses list direction for glossary side (Prompt 4)**

Currently, all imported glossary entries get `side: "A"` hardcoded in `BulkImportDialog.tsx` line 104.

**Changes:**
- **`BulkImportDialog.tsx`** — Use the list's `lang_a` to determine glossary direction. The `original_text` (left of `/`) maps to the primary language (side A), and `translated_text` maps to secondary (side B). This is already correct IF side A = primary language. We just need to ensure the `side` field is set correctly and not hardcoded.
- **Deduplication** — Already works by `original_text + translated_text`, no change needed.
- **Backward compat** — If no glossary section found, import only cards as today. If list has no languages, default to side "A".

---

**4. "Language not defined" indicator (Prompt 1 remainder)**

The existing system defaults to `en`/`pt` silently. Lists that were created before language selection might have wrong defaults.

**Changes:**
- **`ListDetail.tsx`** — Show a subtle badge/indicator when `lang_a` or `lang_b` appear to be defaults and might need review. A small "⚠ Idioma não configurado" near the settings button. Non-intrusive.
- **No migration needed** — old lists keep working with their defaults.

---

### Files Changed (Summary)

| File | Change |
|------|--------|
| `src/features/study/lib/glossaryMerge.ts` | Accept list language context, support bidirectional matching |
| `src/lib/bulkImport.ts` | `AI_HELPER_PROMPT` → `buildAIHelperPrompt(langA, langB)` function |
| `src/components/BulkImportDialog.tsx` | Pass lang codes, use dynamic prompt, set glossary side correctly |
| `src/pages/ListDetail.tsx` | Pass lang codes to BulkImportDialog, add "language not set" indicator |
| `src/pages/Study.tsx` | Pass list languages to glossary merge logic |

### Security
No schema changes needed. No new tables. No RLS changes. All changes are frontend logic only.

