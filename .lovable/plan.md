

## Plan: Multi-Content Study Platform (Incremental Expansion)

### 1. Audit Results

**What already exists and supports flexibility:**
- `lists` table already has `study_type` (string), `lang_a`/`lang_b`, `labels_a`/`labels_b`, `tts_enabled` -- this is the per-list config layer
- `ListStudyTypeSelector` component already supports "language" vs "general" toggle with custom labels
- `flashcards` table has `audio_url`, `hint`, `display_text`, `eval_text`, `note_text` -- extensible columns
- All study views accept dynamic `labelA`/`labelB`, `langA`/`langB`, `ttsEnabled` props
- `gameCore.ts` is content-agnostic (operates on `term`/`translation` strings only)
- `resolveStudySides` is content-agnostic (maps side A/B by direction)

**What's rigid / coupled to language:**
- `flashcards` table has NO `image_url_a` or `image_url_b` columns
- `CreateFlashcardForm` only has text inputs (no image URL field)
- `EditFlashcardDialog` -- same, text-only
- `BulkImportDialog` -- text-only import
- `FlipStudyView`, `WriteStudyView`, `MultipleChoiceStudyView`, `UnscrambleStudyView` -- render text only, no image rendering
- `Flashcard.tsx` (card preview) -- text only
- TTS buttons are always visible in FlipStudyView (should be conditional on `ttsEnabled`)
- The "Ouvir" button shows even when `ttsEnabled` is false

**What's already "almost there":**
- The `study_type` field on `lists` already exists -- just needs more values
- `ttsEnabled` prop is already passed to study views but not always respected (FlipStudyView shows Volume2 buttons unconditionally in normal mode)

### 2. Proposed Changes (Incremental, 3 Phases)

---

**Phase 1: Database + Image URL support (this sprint)**

1. **Migration: Add image columns to `flashcards`**
   - `image_url_a TEXT` (nullable) -- image for side A
   - `image_url_b TEXT` (nullable) -- image for side B
   - No breaking change: all existing rows get NULL

2. **Expand `study_type` vocabulary on `lists`**
   - Currently supports `"language"` and `"general"`.
   - Add support for `"math"`, `"visual"` as recognized values.
   - No schema change needed (column is already `text`).

3. **Define a StudyTypeConfig map** (new file: `src/features/study/lib/studyTypeConfig.ts`)
   ```text
   StudyTypeConfig = {
     language: { textA: true, textB: true, tts: true, imageA: false, imageB: false },
     general:  { textA: true, textB: true, tts: false, imageA: optional, imageB: optional },
     math:     { textA: true, textB: true, tts: false, imageA: optional, imageB: optional },
     visual:   { textA: optional, textB: optional, tts: optional, imageA: true, imageB: true },
   }
   ```
   This is a pure data map -- no logic, just feature flags per study type.

**Phase 2: UI -- Card Creation + Editing with Image URL**

4. **Update `CreateFlashcardForm`**
   - Accept `studyType` prop
   - Conditionally show "Image URL (Side A)" and "Image URL (Side B)" fields when the study type config allows images
   - Pass `image_url_a` / `image_url_b` to the `onAdd` callback

5. **Update `EditFlashcardDialog`**
   - Same: add image URL fields, conditional on study type

6. **Update `BulkImportDialog`**
   - Add optional columns for image URLs in TSV/CSV import

7. **Update `ListStudyTypeSelector`**
   - Add "math" and "visual" options (with icons)
   - Show/hide TTS toggle based on StudyTypeConfig

**Phase 3: Study Views -- Render Images**

8. **Create `ImageCard` component** (`src/features/study/components/ImageCard.tsx`)
   - Renders an image from URL with loading/error states
   - Handles validation (is URL reachable?)
   - Supports external CDN, Dropbox (`dl=1` transform), Google Drive (`/uc?export=view` transform)

9. **Update `FlipStudyView`**
   - If `image_url_a` exists on current card, render ImageCard alongside or instead of text
   - Hide TTS buttons when `ttsEnabled === false` (bug fix)

10. **Update other study views** (Write, MultipleChoice, Unscramble)
    - Show image as part of the prompt when available
    - Answer input remains text-based

11. **Update `Flashcard.tsx`** (card preview in list)
    - Show thumbnail if image URL exists

### 3. Files Affected

| File | Change |
|---|---|
| `supabase/migrations/new` | Add `image_url_a`, `image_url_b` to flashcards |
| `src/features/study/lib/studyTypeConfig.ts` | NEW -- StudyTypeConfig map |
| `src/features/study/components/ListStudyTypeSelector.tsx` | Add math/visual options |
| `src/components/CreateFlashcardForm.tsx` | Add image URL fields |
| `src/components/EditFlashcardDialog.tsx` | Add image URL fields |
| `src/components/BulkImportDialog.tsx` | Support image URL columns |
| `src/features/study/components/ImageCard.tsx` | NEW -- image renderer |
| `src/features/study/components/FlipStudyView.tsx` | Render images, fix TTS visibility |
| `src/features/study/components/WriteStudyView.tsx` | Render images in prompt |
| `src/features/study/components/MultipleChoiceStudyView.tsx` | Render images in prompt |
| `src/features/study/components/UnscrambleStudyView.tsx` | Render images in prompt |
| `src/features/study/components/Flashcard.tsx` | Show image thumbnail |
| `src/pages/ListDetail.tsx` | Pass studyType to form |

### 4. Compatibility Guarantees

- All existing cards have `image_url_a = NULL`, `image_url_b = NULL` -- no breakage
- All existing lists have `study_type = 'language'` or `'general'` -- no breakage
- Image rendering is purely additive: only shown when URL is present
- TTS continues to work exactly as before for `language` type
- `gameCore.ts` is NOT touched (protected module)
- `useStudyEngine.ts` is NOT touched (operates on IDs only)

### 5. Risk Assessment

- **Low risk**: DB migration adds nullable columns only
- **Low risk**: StudyTypeConfig is a pure data map, no logic change
- **Medium risk**: Image URL rendering needs error handling (broken links, CORS). Mitigated by `ImageCard` component with fallback states.
- **No risk** to existing language study flow

### 6. Recommended Implementation Order

1. Phase 1 first (DB + config map) -- enables everything else
2. Phase 2 (creation/editing) -- users can start adding image URLs
3. Phase 3 (study views) -- images render during study

Each phase is independently deployable and safe.

