export type MixedPlayableMode = "write" | "unscramble" | "multiple-choice" | "pronunciation";
export type RandomSource = () => number;

export const MIXED_MODE_MAX_STREAK = 2;
export const MIXED_MODE_WEIGHTS: Readonly<Record<MixedPlayableMode, number>> = {
  write: 40,
  unscramble: 25,
  "multiple-choice": 20,
  pronunciation: 15,
};
