

# Plan: Word Hints in Study Modes + Offline Support

This plan covers two features requested in the same message.

---

## FEATURE 1: Word Hints Integration in All Study Modes

### Current State
- `InteractiveText` component exists and works in `FlipStudyView` only
- `word_hints` field exists on flashcards and is fetched in `Study.tsx`
- Other 4 modes (Write, MultipleChoice, Unscramble, Pronunciation) render plain text

### What needs to change

**1. Study.tsx** — Pass `wordHints` to all modes (currently only passed to Flip)
- Add `wordHintsA={currentCard.word_hints}` prop to Write, MultipleChoice, Unscramble, and Pronunciation renders

**2. WriteStudyView.tsx**
- Add `wordHintsA?: unknown` prop
- Import `InteractiveText`
- Replace `{prompt}` (line 190) with `<InteractiveText text={prompt} wordHints={promptWordHints} />`
- Resolve which side's hints to show based on direction (using `isAFirst` from `resolveStudySides`)

**3. MultipleChoiceStudyView.tsx**
- Add `wordHintsA?: unknown` to `currentCard` interface
- Import `InteractiveText`
- Replace `{prompt}` (line 178) with `<InteractiveText text={prompt} wordHints={promptWordHints} />`
- Resolve hints based on direction

**4. UnscrambleStudyView.tsx**
- Add `wordHintsA?: unknown` prop
- Import `InteractiveText`
- Replace `{question}` (line 193) with `<InteractiveText text={question} wordHints={promptWordHints} />`
- Resolve hints based on direction

**5. PronunciationStudyView.tsx**
- Add `wordHintsA?: unknown` prop
- Import `InteractiveText`
- Replace `{speakSide.text}` (line 176) with `<InteractiveText text={speakSide.text} wordHints={...} />`
- Also replace hint side text (line 181) with interactive version

### Hints direction logic (same pattern as FlipStudyView)
Each view already calls `resolveStudySides` and knows `isAFirst`. The rule:
- `wordHintsA` comes from `currentCard.word_hints` (always sideA data)
- If `isAFirst` → prompt gets `wordHintsA`, answer gets none
- If `!isAFirst` → prompt gets none, answer gets `wordHintsA`

This keeps the canonical mapping intact.

---

## FEATURE 2: Offline Support (IndexedDB-based)

### Architecture

```text
┌─────────────┐       ┌──────────────┐       ┌──────────────┐
│  UI Layer   │──────▶│ offlineStore  │──────▶│  IndexedDB   │
│ (Download   │       │ (lib/offline  │       │  (idb-keyval │
│  button,    │       │  Manager.ts)  │       │   or raw)    │
│  status)    │       └──────────────┘       └──────────────┘
└─────────────┘
```

### New files to create

**1. `src/lib/offlineStore.ts`** — Core offline data manager
- Uses IndexedDB via lightweight wrapper (native `idb` API or small helper)
- Key operations:
  - `downloadListForOffline(listId)` — fetches list metadata + all flashcards + favorites, stores in IndexedDB keyed by listId
  - `getOfflineList(listId)` — returns stored list data or null
  - `isListAvailableOffline(listId)` — boolean check
  - `removeOfflineList(listId)` — cleanup
  - `getOfflineStatus(listId)` — returns `{ available, lastSync, cardCount }`
  - `syncOfflineList(listId)` — re-downloads fresh data when online
- Data structure per list:
  ```ts
  interface OfflineListData {
    listId: string;
    listMeta: { title, lang_a, lang_b, labels_a, labels_b, study_type, ... };
    flashcards: Flashcard[];
    favorites: string[]; // card IDs
    downloadedAt: string; // ISO timestamp
    version: number;
  }
  ```

**2. `src/hooks/useOffline.ts`** — React hook
- `useOfflineStatus(listId)` — returns `{ isAvailable, isDownloading, lastSync }`
- `useDownloadForOffline(listId)` — mutation to trigger download
- `useRemoveOffline(listId)` — mutation to remove
- Detects online/offline via `navigator.onLine` + event listeners

**3. `src/components/OfflineIndicator.tsx`** — Small status badge
- Shows cloud-download icon or checkmark
- Shows "Last sync: X ago"

**4. `src/components/DownloadOfflineButton.tsx`** — Button for list detail page
- Toggle button: "Download for offline" / "Available offline ✓"
- Shows progress state while downloading

### Integration points

**ListDetail.tsx** — Add `DownloadOfflineButton` in the header area

**Study.tsx** — Modify `loadFlashcards`:
- If `!navigator.onLine`, try `getOfflineList(listId)` first
- If offline data exists, use it instead of Supabase query
- If no offline data and no internet, show clear error state

**GamesHub.tsx** — Show offline badge on lists that are downloaded

### PWA / Service Worker
- Already configured via `vite-plugin-pwa`
- Add `navigateFallbackDenylist: [/^\/~oauth/]` (missing currently)
- Add runtime caching for card images:
  ```ts
  {
    urlPattern: /\.(png|jpg|jpeg|webp|gif)$/i,
    handler: 'CacheFirst',
    options: { cacheName: 'card-images', expiration: { maxEntries: 500 } }
  }
  ```

### TTS/Audio offline
- Browser SpeechSynthesis API works offline on most devices (uses local voices)
- Edge TTS (cloud) will NOT work offline → show graceful fallback message
- No audio caching in this initial version (noted as limitation)

### Sync strategy
- On app focus + online: check if any offline lists need refresh
- Simple "last-write-wins" — offline is read-only (no offline edits in v1)
- Re-download replaces local data entirely

### Backward compatibility
- Zero impact on existing lists — offline is opt-in per list
- No DB migration needed (all client-side storage)
- Lists without offline data continue working exactly as before

---

## Files to modify/create summary

| File | Action | Purpose |
|---|---|---|
| `src/lib/offlineStore.ts` | **Create** | IndexedDB offline data manager |
| `src/hooks/useOffline.ts` | **Create** | React hooks for offline state |
| `src/components/OfflineIndicator.tsx` | **Create** | Status badge component |
| `src/components/DownloadOfflineButton.tsx` | **Create** | Download toggle button |
| `src/features/study/components/WriteStudyView.tsx` | Edit | Add InteractiveText for prompt |
| `src/features/study/components/MultipleChoiceStudyView.tsx` | Edit | Add InteractiveText for prompt |
| `src/features/study/components/UnscrambleStudyView.tsx` | Edit | Add InteractiveText for prompt |
| `src/features/study/components/PronunciationStudyView.tsx` | Edit | Add InteractiveText for both sides |
| `src/pages/Study.tsx` | Edit | Pass wordHints to all modes + offline fallback |
| `src/pages/ListDetail.tsx` | Edit | Add DownloadOfflineButton |
| `src/pages/GamesHub.tsx` | Edit | Show offline badge |
| `vite.config.ts` | Edit | Add navigateFallbackDenylist + image cache |

### Tests
- Word hints rendering in each study mode (unit tests on InteractiveText are already passing — integration is the gap)
- Offline store: save/load/delete cycle
- Offline detection: fallback to IndexedDB when offline
- Empty states: no offline data + no internet = clear message

