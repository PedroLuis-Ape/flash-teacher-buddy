export type CurrentDetailedExplanation = {
  explanation?: string | null;
  usageNotes?: string | null;
  commonMistakes?: string | null;
};

let currentValue: CurrentDetailedExplanation = {};
const subscribers = new Set<() => void>();

export function setCurrentDetailedExplanation(value: CurrentDetailedExplanation) {
  currentValue = value;
  subscribers.forEach((callback) => callback());
}

export function getCurrentDetailedExplanation() {
  return currentValue;
}

export function subscribeCurrentDetailedExplanation(callback: () => void) {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
