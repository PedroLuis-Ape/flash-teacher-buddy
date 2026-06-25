export interface OrderedPublicTurma {
  id: string;
  public?: boolean | null;
  ativo?: boolean | null;
  public_order_index?: number | null;
  created_at?: string | null;
}

function createdAtValue(value: string | null | undefined): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function sortPublicTurmasByOrder<T extends OrderedPublicTurma>(items: readonly T[]): T[] {
  return items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((left, right) => {
      const leftOrder = Number(left.item.public_order_index ?? 0);
      const rightOrder = Number(right.item.public_order_index ?? 0);
      const leftHasOrder = Number.isFinite(leftOrder) && leftOrder > 0;
      const rightHasOrder = Number.isFinite(rightOrder) && rightOrder > 0;

      if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      if (leftHasOrder !== rightHasOrder) {
        return leftHasOrder ? -1 : 1;
      }

      const createdDifference = createdAtValue(right.item.created_at) - createdAtValue(left.item.created_at);
      if (createdDifference !== 0) return createdDifference;
      return left.originalIndex - right.originalIndex;
    })
    .map(({ item }) => item);
}

export function sortTurmasForManagement<T extends OrderedPublicTurma>(items: readonly T[]): T[] {
  const publicTurmas = sortPublicTurmasByOrder(
    items.filter((item) => item.public === true && item.ativo !== false),
  );
  const remaining = items
    .filter((item) => !(item.public === true && item.ativo !== false))
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((left, right) => {
      const createdDifference = createdAtValue(right.item.created_at) - createdAtValue(left.item.created_at);
      return createdDifference || left.originalIndex - right.originalIndex;
    })
    .map(({ item }) => item);

  return [...publicTurmas, ...remaining];
}

export function movePublicTurmaToPosition<T extends OrderedPublicTurma>(
  items: readonly T[],
  turmaId: string,
  targetIndex: number,
): T[] {
  const currentIndex = items.findIndex((item) => item.id === turmaId);
  if (currentIndex < 0) return [...items];

  const boundedTarget = Math.max(0, Math.min(targetIndex, items.length - 1));
  if (currentIndex === boundedTarget) return [...items];

  const next = [...items];
  const [moved] = next.splice(currentIndex, 1);
  next.splice(boundedTarget, 0, moved);
  return next;
}

export function publicTurmaPositionLabel(index: number): string {
  return String(index + 1).padStart(3, "0");
}
