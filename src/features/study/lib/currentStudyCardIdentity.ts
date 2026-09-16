export type CurrentStudyCardIdentity = {
  cardId: string | null;
  layerIndex: number | null;
};

let currentValue: CurrentStudyCardIdentity = {
  cardId: null,
  layerIndex: null,
};

const subscribers = new Set<() => void>();

export function setCurrentStudyCardIdentity(
  cardId: string | null | undefined,
  layerIndex: number | null | undefined,
): void {
  const next: CurrentStudyCardIdentity = {
    cardId: cardId ?? null,
    layerIndex: layerIndex ?? null,
  };

  if (
    currentValue.cardId === next.cardId
    && currentValue.layerIndex === next.layerIndex
  ) return;

  currentValue = next;
  subscribers.forEach((callback) => callback());
}

export function getCurrentStudyCardIdentity(): CurrentStudyCardIdentity {
  return currentValue;
}

export function subscribeCurrentStudyCardIdentity(callback: () => void): () => void {
  subscribers.add(callback);
  return () => subscribers.delete(callback);
}
