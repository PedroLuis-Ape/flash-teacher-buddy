import { useMemo } from "react";
import type { Direction } from "@/features/study/lib/gameCore";
import { listIdFromPath } from "./listRoute";
import { useListPrimary } from "./useListPrimary";
import { primarySideToDirection } from "./primarySideDirection";

export function useListDirection(fallback: Direction) {
  const listId = useMemo(() => listIdFromPath(location.pathname), []);
  const side = useListPrimary(listId);
  return { listId, side, direction: listId ? primarySideToDirection(side) as Direction : fallback };
}
