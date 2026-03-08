

## Technical Clarification: Canonical Mapping & Direction System

### 1. Current Canonical Mapping Rules

The full data chain is:

```text
DB (lists table)          Code (Study.tsx)         Study Views
─────────────────         ──────────────────       ─────────────────
lang_a  ──────────────→   langA  ──────────────→   sideA.lang
lang_b  ──────────────→   langB  ──────────────→   sideB.lang
labels_a ─────────────→   labelsA ─────────────→   sideA.label
labels_b ─────────────→   labelsB ─────────────→   sideB.label

DB (flashcards table)     Code                     Study Views
─────────────────         ──────────────────       ─────────────────
term     ─────────────→   front  ──────────────→   sideA.text
translation ──────────→   back   ──────────────→   sideB.text
```

**Rule**: `lang_a` is ALWAYS the language of `term`. `lang_b` is ALWAYS the language of `translation`. No swap, no conditional, no exception.

### 2. Direction Enum: Legacy Names, Abstract Meaning

The direction type is `"en-pt" | "pt-en" | "any"`. These names are **legacy artifacts** from when the app only supported English/Portuguese. They do NOT refer to actual languages. Their real meaning:

| Direction value | Actual meaning | prompt = | answer = |
|---|---|---|---|
| `"en-pt"` | Side A first | sideA (term) | sideB (translation) |
| `"pt-en"` | Side B first | sideB (translation) | sideA (term) |
| `"any"` | Random per card | hash-based | the other |

**Evidence in code** (Study.tsx lines 615-617):
```tsx
<SelectItem value="en-pt">{listSettings.labelsA} → {listSettings.labelsB}</SelectItem>
<SelectItem value="pt-en">{listSettings.labelsB} → {listSettings.labelsA}</SelectItem>
```

So for a fr↔en deck where `labelsA = "Français"` and `labelsB = "English"`:
- `"en-pt"` shows as **"Français → English"** (sideA first)
- `"pt-en"` shows as **"English → Français"** (sideB first)

The UI labels are correct. The enum values are misleading but harmless -- they're abstract tokens.

### 3. Legacy/Conflicting Terms Audit

| Term in code | Where | Status |
|---|---|---|
| `"en-pt"` / `"pt-en"` | `Direction` type in gameCore.ts, useStudyEngine.ts, Study.tsx | **Legacy name, abstract meaning -- NOT a bug** |
| `front` / `back` | FlipStudyView props, Study.tsx render | Aliases for `term` / `translation` -- consistent |
| `term` / `translation` | DB column, flashcard interface | Canonical source -- maps to sideA/sideB |
| `sideA` / `sideB` | resolveStudySides, FlipStudyView internal | Derived from term/translation -- correct |
| `promptSide` / `answerSide` | resolveStudySides output | Derived from direction -- correct |
| `firstSide` / `secondSide` | FlipStudyView local vars | Aliases for promptSide/answerSide -- correct |
| `native` / `foreign` | **Not found anywhere** | Clean |
| `source` / `target` | **Not found anywhere** | Clean |
| `question` / `answer` | **Not found anywhere** | Clean |
| `language1` / `language2` | **Not found anywhere** | Clean |

**Conclusion**: No conflicting mappings exist. The only legacy issue is the enum name `"en-pt"` / `"pt-en"`, which functions correctly as an abstract direction indicator.

### 4. Explicit 5-Example Table (fr↔en deck)

Deck config: `lang_a = "fr"`, `lang_b = "en"`, `labels_a = "Français"`, `labels_b = "English"`

| # | term (sideA) | translation (sideB) | Direction | Prompt shown | Answer expected |
|---|---|---|---|---|---|
| 1 | bonjour | hello | `"en-pt"` (A→B) | **bonjour** (fr) | **hello** (en) |
| 2 | bonjour | hello | `"pt-en"` (B→A) | **hello** (en) | **bonjour** (fr) |
| 3 | merci | thank you | `"en-pt"` (A→B) | **merci** (fr) | **thank you** (en) |
| 4 | merci | thank you | `"pt-en"` (B→A) | **thank you** (en) | **merci** (fr) |
| 5 | au revoir | goodbye | `"any"` | hash-dependent | the other side |

### 5. Corrected Test Step 7A

The previous report incorrectly mixed "pt" into a fr↔en scenario. Corrected:

**Test for fr↔en deck:**
1. Create a list with `lang_a = fr`, `lang_b = en`
2. Add card: Français = "bonjour", English = "hello"
3. Edit the card → confirm fields show "bonjour" in Français, "hello" in English
4. Study with direction selector showing **"Français → English"** (`"en-pt"` value):
   - Prompt = "bonjour", Answer = "hello" ✓
5. Switch to **"English → Français"** (`"pt-en"` value):
   - Prompt = "hello", Answer = "bonjour" ✓
6. Never should "hello" appear labeled as Français

### 6. Test Evidence

The regression tests are in `src/features/study/lib/i18nRegression.test.ts`. The 15 new tests added in the "Canonical mapping" describe block are:

For each of 5 language pairs (fr→en, en→fr, en→pt, pt→fr, de→ja):
1. `[fr→en] term is in lang_a, translation is in lang_b` -- validates DB→code mapping
2. `[fr→en] sideA.text=term, sideB.text=translation after resolveStudySides` -- validates both directions
3. `[fr→en] edit dialog returns original values unchanged` -- validates edit roundtrip

Total: 5 pairs × 3 tests = **15 new tests**.

These tests can be run with:
```
npx vitest run src/features/study/lib/i18nRegression.test.ts
```

### 7. Remaining Consideration: Rename Direction Enum

The `"en-pt"` / `"pt-en"` enum values are technically correct but semantically misleading. A future rename to `"a-to-b"` / `"b-to-a"` would improve clarity. This is cosmetic -- it requires updating the type, all references in gameCore.ts, useStudyEngine.ts, Study.tsx, and all study view components. It's a separate task, not a bug.

**Should I rename the direction enum values from `"en-pt"/"pt-en"` to `"a-to-b"/"b-to-a"` for clarity?** This is optional and purely cosmetic.

