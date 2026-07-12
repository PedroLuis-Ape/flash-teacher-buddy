# Persistent Play Preset — Design

## Goal

Keep the study screen visually minimal with only the existing **Play** button visible, while allowing users to configure Play behavior inside the existing session settings dialog and persist that choice globally or per private list.

## User experience

The study screen continues to show only:

```text
[ Play ]
```

Pressing Play starts immediately with the saved preset. It never opens a configuration dialog.

The existing gear dialog gains a **Configurações do Play** section with:

- playback mode: `Dois lados` or `Somente um lado`;
- side: side A or side B;
- when mode is `Dois lados`, the side is the first side spoken;
- when mode is `Somente um lado`, the side is the only side shown and spoken.

Labels use the list's real side labels, not hard-coded Portuguese/English.

## Persistent contract

Extend `StudyPreset` with:

```ts
playMode: "both" | "single";
playSide: "a" | "b";
```

Defaults preserve the current behavior:

```ts
playMode: "both";
playSide: "a";
```

The fields follow the existing hierarchy:

```text
safe defaults → global user preset → private-list override → temporary session override
```

Portal routes remain temporary and do not persist personal changes.

## Playback state machine

### Both sides

```text
configured side → wait existing delay → opposite side → wait existing delay → next card
```

### Single side

```text
configured side → wait existing delay → next card
```

At the final card, Play stops normally.

During single-side Play, the other side is neither spoken nor revealed. Fast Mode must not expose both sides while single-side Play is active.

## Storage

Add `play_mode` and `play_side` columns to:

- `public.user_study_preferences`;
- `public.user_list_study_preferences`.

Global columns are non-null with safe defaults. List override columns are nullable.

A new additive migration is required because the previous preference migration has already been applied in production.

## Non-goals

- no new information beside the Play button;
- no interval selector in this release;
- no repeated audio, shadowing or audio-only presets in this release;
- no changes to scoring, card order, red-focus repetition or session progress.

## Acceptance criteria

1. Only the Play/Pause button remains in the autoplay bar.
2. Play starts immediately using the persisted preset.
3. Both-side mode preserves the current sequence.
4. Single-side mode speaks and shows one side once, then advances.
5. Settings persist globally and may be overridden per private list.
6. Public portal changes do not modify personal presets.
7. Existing users retain the current behavior by default.
8. Typecheck, tests, lint and production build pass.