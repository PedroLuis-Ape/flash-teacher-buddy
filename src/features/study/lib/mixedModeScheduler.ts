export type MixedPlayableMode = "write" | "unscramble" | "multiple-choice" | "pronunciation";
export type RandomSource = () => number;

export const MIXED_MODE_MAX_STREAK = 2;
export const MIXED_MODE_WEIGHTS: Readonly<Record<MixedPlayableMode, number>> = {
  write: 40,
  unscramble: 25,
  "multiple-choice": 20,
  pronunciation: 15,
};

const FULL_PATTERN: readonly MixedPlayableMode[] = [
  "write", "unscramble", "write", "multiple-choice", "write",
  "pronunciation", "unscramble", "write", "multiple-choice", "write",
  "unscramble", "pronunciation", "write", "multiple-choice", "unscramble",
  "write", "pronunciation", "multiple-choice", "write", "unscramble",
];

export function createMixedModeSchedule(
  questionCount: number,
  pronunciationSupported = true,
  random: RandomSource = Math.random,
): MixedPlayableMode[] {
  const total = Math.max(0, Math.floor(questionCount));
  if (total === 0) return [];
  void pronunciationSupported;
  void random;
  const output: MixedPlayableMode[] = [];
  while (output.length < total) output.push(...FULL_PATTERN);
  return output.slice(0, total);
}
