export interface OrderedAssignment {
  id: string;
  order_index?: number | null;
  created_at?: string | null;
}

export function sortAssignmentsByOrder<T extends OrderedAssignment>(items: T[]): T[] {
  return items
    .map((item, originalIndex) => ({ item, originalIndex }))
    .sort((left, right) => {
      const leftOrder = Number(left.item.order_index ?? 0);
      const rightOrder = Number(right.item.order_index ?? 0);
      const leftHasOrder = Number.isFinite(leftOrder) && leftOrder > 0;
      const rightHasOrder = Number.isFinite(rightOrder) && rightOrder > 0;

      if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      if (leftHasOrder !== rightHasOrder) {
        return leftHasOrder ? -1 : 1;
      }

      const leftCreatedAt = left.item.created_at ? new Date(left.item.created_at).getTime() : 0;
      const rightCreatedAt = right.item.created_at ? new Date(right.item.created_at).getTime() : 0;
      if (leftCreatedAt !== rightCreatedAt) {
        return leftCreatedAt - rightCreatedAt;
      }

      return left.originalIndex - right.originalIndex;
    })
    .map(({ item }) => item);
}

export function moveAssignmentToPosition<T extends OrderedAssignment>(
  items: T[],
  assignmentId: string,
  targetIndex: number,
): T[] {
  const currentIndex = items.findIndex((item) => item.id === assignmentId);
  if (currentIndex < 0) return items;

  const boundedTarget = Math.max(0, Math.min(targetIndex, items.length - 1));
  if (currentIndex === boundedTarget) return items;

  const next = [...items];
  const [moved] = next.splice(currentIndex, 1);
  next.splice(boundedTarget, 0, moved);
  return next;
}

export function assignmentPositionLabel(index: number): string {
  return String(index + 1).padStart(3, '0');
}
