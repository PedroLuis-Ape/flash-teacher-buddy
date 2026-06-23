export type CurrentDetailedExplanation = {
  explanation?: string | null;
  usageNotes?: string | null;
  commonMistakes?: string | null;
};

let currentValue: CurrentDetailedExplanation = {};
const subscribers = new Set<() => void>();

export function setCurrentDetailedExplanation(value: CurrentDetailedExplanation): void {
  currentValue = value;
  subscribers.forEach((callback) => callback());
}

export function getCurrentDetailedExplanation(): CurrentDetailedExplanation {
  return currentValue;
}

export function subscribeCurrentDetailedExplanation(callback: () => void): () => void {
  subscribers.add(callback);
  return function cleanup() {
    subscribers.delete(callback);
  };
}
