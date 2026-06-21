export type ConcreteDirection = "a-b" | "b-a";
export type RandomSource = () => number;
export const DIRECTION_MAX_STREAK = 2;

export function createDirectionSchedule(
  questionCount: number,
  random: RandomSource = Math.random,
): ConcreteDirection[] {
  const total = Math.max(0, Math.floor(questionCount));
  if (total === 0) return [];

  const half = Math.floor(total / 2);
  const extraForA = total % 2 === 0 || random() < 0.5;
  let aRemaining = extraForA ? total - half : half;
  let bRemaining = total - aRemaining;
  const output: ConcreteDirection[] = [];

  while (output.length < total) {
    const last = output[output.length - 1];
    const previous = output[output.length - 2];
    const blocked = last && last === previous ? last : null;
    const canUseA = aRemaining > 0 && blocked !== "a-b";
    const canUseB = bRemaining > 0 && blocked !== "b-a";

    let selected: ConcreteDirection;
    if (canUseA && canUseB) {
      selected = random() * (aRemaining + bRemaining) < aRemaining ? "a-b" : "b-a";
    } else if (canUseA) {
      selected = "a-b";
    } else if (canUseB) {
      selected = "b-a";
    } else {
      selected = aRemaining > 0 ? "a-b" : "b-a";
    }

    output.push(selected);
    if (selected === "a-b") aRemaining -= 1;
    else bRemaining -= 1;
  }

  return output;
}
