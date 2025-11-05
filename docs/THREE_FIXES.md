# Three Fixes Implementation Guide

## Summary
This document describes three critical fixes applied to the APE platform:
1. **Store Curation** - Only approved items by Pedro shown in store
2. **TTS Auto-Language** - Automatic language detection with parentheses removal
3. **Parentheses as Annotations** - Content in parentheses not required in answers

---

## A) STORE CURATION

### Goal
- Show only approved items by Pedro in store
- Remove duplicates (e.g., "PITECO Vampiro" appeared 2x)
- Quarantine unauthorized assets without deletion

### Database Changes
Added fields to `public_catalog`:
- `approved` (boolean, default: false)
- `approved_by` (text, stores approver username)
- `slug` (text, unique identifier for deduplication)

Created `quarantine_logs` table:
- Tracks removed/quarantined items
- Stores: filename, original_path, moved_to, actor, reason, metadata
- RLS policies: developer admins can view, system can insert

### Implementation

**Whitelist** (`src/lib/storeEngine.ts`):
```typescript
const ALLOWED_SLUGS = [
  'piteco_vampiro',
  'piteco_prime',
  'piteco_astronaut',
  'piteco_gold',
  'piteco_scientist'
];
```

**Store Query**:
- Filters by: `approved = true` AND `slug IN ALLOWED_SLUGS`
- Deduplicates by slug (keeps most recent per slug)

**Migration Strategy**:
- Existing items automatically assigned slugs based on name
- Duplicates marked with `_dup_2`, `_dup_3`, etc.
- Only the most recent duplicate is `approved = true`

### Files Modified
- `src/lib/storeEngine.ts` - Added whitelist and deduplication
- Database migration - Added fields and quarantine_logs table

---

## B) TTS AUTO-LANGUAGE

### Goal
- Speak English with EN voice and Portuguese with PT-BR voice
- Don't pronounce content in parentheses (annotations)
- Allow override per deck/card

### Database Changes
Added optional fields:
- `flashcards.lang` - Card-level language override
- `lists.lang` - Deck-level language setting

### Implementation

**Language Detection** (`src/lib/speech.ts`):
Priority order:
1. Card language (if specified)
2. Deck language (if specified)
3. Auto-detect via heuristics

**Heuristics**:
- Portuguese indicators: `áéíóúâêîôûãõç` or common words like `o, a, de, que, não, ser, estar`
- English: ASCII ratio > 60%

**Parentheses Removal**:
- All text passed to TTS has parentheses stripped
- Regex: `/\([^)]*\)/g`

**Example**:
```typescript
// Input: "I am (verbo ser/estar)"
// Clean: "I am"
// Detected: "en-US"
// Voice: English voice
```

### Files Modified
- `src/lib/speech.ts` - Updated `speakText()` with auto-detection
- `src/lib/languageHelpers.ts` - NEW file with detection helpers
- `src/lib/textMatch.ts` - Added `stripParentheses()` and `extractAnnotations()`

---

## C) PARENTHESES AS ANNOTATIONS

### Goal
- Content in parentheses is annotation/help only
- Not required in answers, MCQ, or games
- Shown as tooltip/info icon

### Database Changes
Added optional fields to `flashcards`:
- `display_text` - Original text with parentheses
- `eval_text` - Text without parentheses (for evaluation)
- `note_text` - Array of extracted annotations

### Implementation

**Core Helpers** (`src/lib/textMatch.ts`):
```typescript
// Remove parentheses
stripParentheses("I am (verb)") // → "I am"

// Extract annotations
extractAnnotations("I am (verb) (present)") // → ["verb", "present"]

// Normalize for comparison (includes parentheses removal)
normalize("I am (verb)") // → "i am"
```

**Answer Validation**:
- `normalize()` function now strips parentheses FIRST
- All games (Write, MCQ, Unscramble) automatically benefit
- User typing "I am" matches "I am (verbo ser/estar)"

### Files Modified
- `src/lib/textMatch.ts` - Updated `normalize()` to strip parentheses
- `src/lib/languageHelpers.ts` - Shared helpers for annotations
- All study views automatically benefit (no changes needed)

---

## QA CHECKLIST

### Store Curation ✓
- [ ] Store shows only: PITECO Vampiro, PITECO Prime (1 each)
- [ ] No duplicate items visible
- [ ] Extra assets moved to quarantine (check `quarantine_logs` table)

### TTS Auto-Language ✓
- [ ] English sentence with PT annotation → English voice, no parentheses read
- [ ] Portuguese sentence → PT-BR voice
- [ ] Parentheses content never spoken

### Parentheses as Annotations ✓
- [ ] Write mode: typing "I am" accepts when card is "I am (verb)"
- [ ] MCQ: answers compared without parentheses
- [ ] TTS: parentheses not spoken
- [ ] UI: annotations can be shown as tooltip (optional)

---

## Configuration Flags

**Enable/Disable Auto-Detection**:
Currently auto-detection is ALWAYS enabled. To use explicit language only:
1. Set `deckLang` or `cardLang` in data
2. Detection will respect these overrides

**Whitelist Management**:
To add new items to store:
1. Update `ALLOWED_SLUGS` in `src/lib/storeEngine.ts`
2. Set item's `approved = true` and `slug` in database
3. Ensure `approved_by = 'pedro'`

---

## Files Created/Modified

### Created
- `src/lib/languageHelpers.ts` - Language detection and annotation helpers
- `docs/THREE_FIXES.md` - This documentation

### Modified
- `src/lib/storeEngine.ts` - Store curation and deduplication
- `src/lib/textMatch.ts` - Parentheses handling in normalization
- `src/lib/speech.ts` - Auto-language detection and parentheses stripping

### Database Migrations
- Added `approved`, `approved_by`, `slug` to `public_catalog`
- Added `lang`, `display_text`, `eval_text`, `note_text` to `flashcards`
- Added `lang` to `lists`
- Created `quarantine_logs` table with RLS policies
- Unique index on `public_catalog.slug`

---

## Future Enhancements

1. **Admin Panel for Quarantine**:
   - View quarantined items
   - Restore or permanently delete

2. **Upload Policy Enforcement**:
   - Block uploads from non-Pedro accounts
   - Pending review workflow

3. **Annotation UI**:
   - Info icon showing extracted annotations
   - Tooltip on hover

4. **Language Override UI**:
   - Allow users to set deck/card language explicitly
   - Override auto-detection when needed
