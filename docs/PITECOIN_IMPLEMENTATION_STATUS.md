# PiteCOIN implementation status

## Status

The repository now contains the complete frontend integration for the PiteCOIN economy.

Implemented flow:

- authenticated study sessions record each card result with explicit session and card identifiers;
- pending answer writes finish before the session reward is calculated;
- the server calculates PiteCOIN, PTS, XP, streaks, caps and achievements;
- settlement is idempotent and cannot mint the same session reward twice;
- the completion screen shows the reward received;
- balances refresh immediately after settlement;
- PiteCOIN appears on Home, in the header, profile statistics and store;
- PTS remain available for manual conversion in the store;
- store purchases remain atomic through the existing purchase RPC;
- inventory and equipped items continue using the existing store implementation.

## Authority

The frontend does not calculate authoritative balances. It submits the study result and displays the response returned by the backend reward engine.

## Conversion

Manual conversion is the default behavior. Automatic weekly conversion remains disabled until the conversion feature flag and its scheduled backend process are deliberately enabled together.

## Deployment boundary

The code integration is complete in the repository. Database changes were not applied through an unverified administrative connection. Production still needs the documented reward, exchange and purchase RPCs available in the backend used by the published application.
