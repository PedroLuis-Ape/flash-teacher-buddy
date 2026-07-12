# Play Preset Single-Side Implementation Plan

## Goal

Add a persistent Play preset with `both`/`single` playback and side A/B selection, while leaving only the existing Play button visible on the study screen.

## Tasks

### 1. Pure preset contract

- Extend `StudyPreset` with `playMode` and `playSide`.
- Add normalization, diff and default coverage.
- Update legacy compatibility mapping.
- Add tests first.

### 2. Database mapping

- Extend repository row mapping and serialization.
- Add additive migration for `play_mode` and `play_side` on global/list preference tables.
- Add migration contract and repository tests.

### 3. Playback state machine

- Add a pure helper that decides whether Play switches side or advances.
- Cover both-side and single-side behavior with tests.
- Keep the existing 7-second delay.

### 4. UI integration

- Remove the two visible `Começar em...` buttons from `FlipStudyView`.
- Keep only Play/Pause.
- Add Play settings to the existing `GameSettingsModal`.
- Use dynamic labels for side A/B.
- Wire persisted values from `Study` to the modal and Flip view.

### 5. Single-side rendering

- During single-side autoplay, show only the configured side.
- Ensure Fast Mode does not reveal the other side while Play is active.

### 6. Validation

- Run focused tests.
- Run full `Core Quality` and CI workflows.
- Review the diff for persistence leakage, portal behavior and red-focus regressions.
- Merge by squash only after all required checks pass.

## Files

- `src/features/study/preferences/studyPreset.ts`
- `src/features/study/preferences/studyPreset.test.ts`
- `src/features/study/preferences/studyPreferenceRepository.ts`
- `src/features/study/preferences/studyPreferenceRepository.test.ts`
- `src/hooks/useStudyPreferences.ts`
- `src/features/study/lib/flipAutoPlayState.ts`
- `src/features/study/lib/flipAutoPlayState.test.ts`
- `src/features/study/components/FlipStudyView.impl.tsx`
- `src/features/study/components/GameSettingsModal.impl.tsx`
- `src/pages/Study.tsx`
- `supabase/migrations/20260712193000_add_play_preset.sql`
- `src/features/study/preferences/playPreferencesMigration.test.ts`