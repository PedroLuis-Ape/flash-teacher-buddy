export type CurrentDetailedExplanation = {
  explanation?: string | null;
  usageNotes?: string | null;
  commonMistakes?: string | null;
};

export const TOGGLE_DETAILED_EXPLANATION_PANEL_EVENT = "ape:study:toggle-detailed-explanation-panel";

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

export function requestDetailedExplanationPanelToggle(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(TOGGLE_DETAILED_EXPLANATION_PANEL_EVENT));
}

export function subscribeDetailedExplanationPanelToggle(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(TOGGLE_DETAILED_EXPLANATION_PANEL_EVENT, callback);
  return () => window.removeEventListener(TOGGLE_DETAILED_EXPLANATION_PANEL_EVENT, callback);
}
