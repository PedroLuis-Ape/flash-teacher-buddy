export type MixedPlayableMode = "write" | "unscramble" | "multiple-choice" | "pronunciation";
export type RandomSource = () => number;

export const MIXED_MODE_MAX_STREAK = 2;
export const MIXED_MODE_WEIGHTS: Readonly<Record<MixedPlayableMode, number>> = {
  write: 40,
  unscramble: 25,
  "multiple-choice": 20,
  pronunciation: 15,
};

export function createMixedModeSchedule(
  questionCount: number,
  pronunciationSupported = true,
  random: RandomSource = Math.random,
): MixedPlayableMode[] {
  const total = Math.max(0, Math.floor(questionCount));
  if (total === 0) return [];

  const modes: MixedPlayableMode[] = pronunciationSupported
    ? ["write", "unscramble", "multiple-choice", "pronunciation"]
    : ["write", "unscramble", "multiple-choice"];
  const totalWeight = modes.reduce((sum, mode) => sum + MIXED_MODE_WEIGHTS[mode], 0);
  const output: MixedPlayableMode[] = [];

  for (const mode of modes) {
    const amount = Math.floor(total * MIXED_MODE_WEIGHTS[mode] / totalWeight);
    for (let index = 0; index < amount; index += 1) output.push(mode);
  }

  while (output.length < total) output.push(modes[output.length % modes.length]);
  void random;
  return output;
}
