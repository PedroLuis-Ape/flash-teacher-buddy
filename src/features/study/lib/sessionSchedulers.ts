import type { Direction } from "./gameCore";

export type ConcreteDirection = Exclude<Direction, "any">;
export type MixedPlayableMode = "write" | "unscramble" | "multiple-choice" | "pronunciation";
export type RandomSource = () => number;

export const DIRECTION_MAX_STREAK = 2;
export const MIXED_MODE_MAX_STREAK = 2;
export const MIXED_MODE_WEIGHTS: Readonly<Record<MixedPlayableMode, number>> = {
  write: 40,
  unscramble: 25,
  "multiple-choice": 20,
  pronunciation: 15,
};

function shuffle<T>(values: readonly T[], random: RandomSource): T[] {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function streakEndingAt<T>(values: readonly T[], index: number): number {
  if (index < 0 || index >= values.length) return 0;
  let size = 1;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (values[cursor] !== values[index]) break;
    size += 1;
  }
  return size;
}

function repairStreaks<T>(
  input: readonly T[],
  maxFor: (value: T) => number,
): T[] {
  const output = [...input];

  for (let index = 0; index < output.length; index += 1) {
    const current = output[index];
    if (streakEndingAt(output, index) <= maxFor(current)) continue;

    const replacement = output.findIndex((candidate, candidateIndex) =>
      candidateIndex > index && candidate !== current,
    );

    if (replacement >= 0) {
      [output[index], output[replacement]] = [output[replacement], output[index]];
    }
  }

  return output;
}

export function createDirectionSchedule(
  questionCount: number,
  random: RandomSource = Math.random,
): ConcreteDirection[] {
  const count = Math.max(0, Math.floor(questionCount));
  if (count === 0) return [];

  const lowerHalf = Math.floor(count / 2);
  const upperHalf = count - lowerHalf;
  const aFirstGetsExtra = count % 2 === 0 || random() < 0.5;
  const aFirstCount = aFirstGetsExtra ? upperHalf : lowerHalf;
  const bFirstCount = count - aFirstCount;

  const bag: ConcreteDirection[] = [
    ...Array.from({ length: aFirstCount }, () => "a-b" as const),
    ...Array.from({ length: bFirstCount }, () => "b-a" as const),
  ];

  return repairStreaks(shuffle(bag, random), () => DIRECTION_MAX_STREAK);
}

function allocateWeightedCounts(
  count: number,
  modes: readonly MixedPlayableMode[],
): Map<MixedPlayableMode, number> {
  const totalWeight = modes.reduce((sum, mode) => sum + MIXED_MODE_WEIGHTS[mode], 0);
  const allocations = modes.map((mode) => {
    const exact = count * MIXED_MODE_WEIGHTS[mode] / totalWeight;
    return { mode, count: Math.floor(exact), remainder: exact - Math.floor(exact) };
  });

  let assigned = allocations.reduce((sum, allocation) => sum + allocation.count, 0);
  allocations.sort((left, right) => right.remainder - left.remainder);

  for (let index = 0; assigned < count; index = (index + 1) % allocations.length) {
    allocations[index].count += 1;
    assigned += 1;
  }

  return new Map(allocations.map(({ mode, count: modeCount }) => [mode, modeCount]));
}

export function createMixedModeSchedule(
  questionCount: number,
  options: {
    pronunciationSupported?: boolean;
    random?: RandomSource;
  } = {},
): MixedPlayableMode[] {
  const count = Math.max(0, Math.floor(questionCount));
  if (count === 0) return [];

  const random = options.random ?? Math.random;
  const modes = (Object.keys(MIXED_MODE_WEIGHTS) as MixedPlayableMode[])
    .filter((mode) => mode !== "pronunciation" || options.pronunciationSupported !== false);
  const allocations = allocateWeightedCounts(count, modes);
  const bag = modes.flatMap((mode) =>
    Array.from({ length: allocations.get(mode) ?? 0 }, () => mode),
  );

  return repairStreaks(
    shuffle(bag, random),
    (mode) => mode === "pronunciation" ? 1 : MIXED_MODE_MAX_STREAK,
  );
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}
