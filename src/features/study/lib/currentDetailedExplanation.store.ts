export type CurrentDetailedExplanation = {
  explanation?: string | null;
  usageNotes?: string | null;
  commonMistakes?: string | null;
};

let currentValue: CurrentDetailedExplanation = {};
const events = new EventTarget();

export function setCurrentDetailedExplanation(value: CurrentDetailedExplanation): void {
  currentValue = value;
  events.dispatchEvent(new Event("change"));
}

export function getCurrentDetailedExplanation(): CurrentDetailedExplanation {
  return currentValue;
}

export function subscribeCurrentDetailedExplanation(callback: () => void): () => void {
  events.addEventListener("change", callback);
  return () => events.removeEventListener("change", callback);
}
