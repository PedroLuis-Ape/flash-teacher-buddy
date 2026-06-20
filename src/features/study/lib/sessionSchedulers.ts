import {
  createDirectionSchedule,
  type ConcreteDirection,
  type RandomSource,
} from "./directionScheduler";
import {
  createMixedModeSchedule as createBaseMixedSchedule,
  MIXED_MODE_WEIGHTS,
  type MixedPlayableMode,
} from "./mixedModeScheduler";

export { createDirectionSchedule, MIXED_MODE_WEIGHTS };
export type { ConcreteDirection, MixedPlayableMode, RandomSource };

export function createMixedModeSchedule(
  questionCount: number,
  options: {
    pronunciationSupported?: boolean;
    random?: RandomSource;
  } = {},
): MixedPlayableMode[] {
  const random = options.random ?? Math.random;
  const schedule = createBaseMixedSchedule(questionCount, true, random);
  const replacements: Exclude<MixedPlayableMode, "pronunciation">[] = [
    "write",
    "unscramble",
    "multiple-choice",
  ];
  let replacementIndex = 0;
  const supported = options.pronunciationSupported !== false;
  const playable = supported
    ? schedule
    : schedule.map((mode) => {
        if (mode !== "pronunciation") return mode;
        const replacement = replacements[replacementIndex % replacements.length];
        replacementIndex += 1;
        return replacement;
      });

  if (playable.length < 2) return playable;
  const offset = Math.floor(random() * playable.length);
  return [...playable.slice(offset), ...playable.slice(0, offset)];
}

export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "SpeechRecognition" in window || "webkitSpeechRecognition" in window;
}
