# Flip Doom Scroll — implementation contract

- Opt-in only; classic Flip remains the default and keeps `StudyCardDeck`.
- Mobile-only (`< 640px`) and disabled for Mixed slots.
- Uses the existing Flip card implementation unchanged, including two-sided flip, TTS, Play, tools, review flag, difficulty, favorites/red-list and assessment controls.
- Vertical drag owns presentation only; navigation still calls the existing `onNext`/`onPrevious` callbacks from the Study engine.
- Adjacent cards are visual previews derived from the already-persisted Flip queue and fetched read-only by id. They never create or mutate progress/session state.
- Preference is device-local because it is a presentation preference, not learning progress.
- Reduced-motion users get immediate settling rather than animated travel.
