# Flip Doom Scroll QA

- Classic Flip remains unchanged when toggle is off.
- Toggle appears only on mobile Flip.
- Drag up moves current surface with the finger and reveals the next visual card from below.
- Drag down reveals the previous visual card from above.
- Short/slow drag snaps back; committed drag or fast flick navigates.
- Tap still flips the active card.
- TTS, Play/autoplay, tools, review flag, favorites, red list, difficulty, layers and note/editor entry points remain owned by the active Flip card.
- Gamified Flip does not bypass assessment because doom navigation respects `canGoNext`/`onNext` availability.
- Mixed mode does not enable the doom viewport.
- Adjacent visual reads do not write progress or create a second session engine.
