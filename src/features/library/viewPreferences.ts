import { sortResourcesWithFavoritesFirst } from "@/features/study/lib/listMarkers";

export type LibraryViewMode = "list" | "grid";

export const LISTS_VIEW_MODE_KEY = "piteco.lists.viewMode";
export const LISTS_LOCAL_ORDER_KEY = "piteco.lists.localOrder";
export const FOLDERS_VIEW_MODE_KEY = "piteco.folders.viewMode";
export const FOLDERS_LOCAL_ORDER_KEY = "piteco.folders.localOrder";

export function getBrowserStorage(): Storage | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function readViewMode(
  storage: Pick<Storage, "getItem"> | undefined,
  key: string,
  fallback: LibraryViewMode,
): LibraryViewMode {
  try {
    const value = storage?.getItem(key);
    return value === "list" || value === "grid" ? value : fallback;
  } catch {
    return fallback;
  }
}

export function persistViewMode(
  storage: Pick<Storage, "setItem"> | undefined,
  key: string,
  mode: LibraryViewMode,
): void {
  try {
    storage?.setItem(key, mode);
  } catch {
    // Preferences are best-effort when storage is unavailable or full.
  }
}

function normalizeIds(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((id): id is string => typeof id === "string"))]
    : [];
}

function readFolderOrderMap(storage: Pick<Storage, "getItem"> | undefined): Record<string, string[]> {
  try {
    const value = JSON.parse(storage?.getItem(FOLDERS_LOCAL_ORDER_KEY) ?? "null");
    if (Array.isArray(value) || !value || typeof value !== "object") return {};

    return Object.fromEntries(
      Object.entries(value).flatMap(([scopeKey, folderIds]) => {
        const normalized = normalizeIds(folderIds);
        return normalized.length > 0 ? [[scopeKey, normalized]] : [];
      }),
    );
  } catch {
    return {};
  }
}

export function readFolderOrder(
  storage: Pick<Storage, "getItem"> | undefined,
  scopeKey = "default",
): string[] {
  try {
    const value = JSON.parse(storage?.getItem(FOLDERS_LOCAL_ORDER_KEY) ?? "null");
    if (Array.isArray(value)) return scopeKey === "default" ? normalizeIds(value) : [];
    return readFolderOrderMap(storage)[scopeKey] ?? [];
  } catch {
    return [];
  }
}

export function persistFolderOrder(
  storage: Pick<Storage, "getItem" | "setItem"> | undefined,
  folderIds: readonly string[],
  scopeKey = "default",
): void {
  try {
    if (!storage) return;
    const rawValue = JSON.parse(storage.getItem(FOLDERS_LOCAL_ORDER_KEY) ?? "null");
    const orderMap = Array.isArray(rawValue) ? { default: normalizeIds(rawValue) } : readFolderOrderMap(storage);
    const normalized = normalizeIds(folderIds);
    if (normalized.length > 0) orderMap[scopeKey] = normalized;
    else delete orderMap[scopeKey];
    storage.setItem(FOLDERS_LOCAL_ORDER_KEY, JSON.stringify(orderMap));
  } catch {
    // Preferences are best-effort when storage is unavailable or full.
  }
}

function readListOrderMap(storage: Pick<Storage, "getItem"> | undefined): Record<string, string[]> {
  try {
    const value = JSON.parse(storage?.getItem(LISTS_LOCAL_ORDER_KEY) ?? "null");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};

    return Object.fromEntries(
      Object.entries(value).flatMap(([folderId, listIds]) => {
        if (!Array.isArray(listIds)) return [];
        const normalized = [...new Set(listIds.filter((id): id is string => typeof id === "string"))];
        return normalized.length > 0 ? [[folderId, normalized]] : [];
      }),
    );
  } catch {
    return {};
  }
}

export function readListOrder(storage: Pick<Storage, "getItem"> | undefined, folderId: string): string[] {
  if (!folderId) return [];
  return readListOrderMap(storage)[folderId] ?? [];
}

export function persistListOrder(
  storage: Pick<Storage, "getItem" | "setItem"> | undefined,
  folderId: string,
  listIds: readonly string[],
): void {
  if (!storage || !folderId) return;

  try {
    const orderMap = readListOrderMap(storage);
    const normalized = [...new Set(listIds.filter((id): id is string => typeof id === "string"))];
    if (normalized.length > 0) orderMap[folderId] = normalized;
    else delete orderMap[folderId];

    if (Object.keys(orderMap).length > 0) storage.setItem(LISTS_LOCAL_ORDER_KEY, JSON.stringify(orderMap));
    else storage.setItem(LISTS_LOCAL_ORDER_KEY, JSON.stringify({}));
  } catch {
    // Preferences are best-effort when storage is unavailable or full.
  }
}

export function applyLocalFolderOrder<T extends { id: string }>(resources: readonly T[], localOrder: readonly string[]): T[] {
  const byId = new Map(resources.map((resource) => [resource.id, resource]));
  const ordered = localOrder.flatMap((id) => {
    const resource = byId.get(id);
    return resource ? [resource] : [];
  });
  const orderedIds = new Set(ordered.map((resource) => resource.id));
  return [...ordered, ...resources.filter((resource) => !orderedIds.has(resource.id))];
}

export function sortResourcesWithLocalOrder<T extends { id: string; title: string }>(
  resources: readonly T[],
  favoriteIds: readonly string[],
  localOrder: readonly string[],
): T[] {
  const locallyOrdered = applyLocalFolderOrder(resources, localOrder);
  const knownIds = new Set(locallyOrdered.map((resource) => resource.id));
  if (!localOrder.some((id) => knownIds.has(id))) return sortResourcesWithFavoritesFirst(locallyOrdered, favoriteIds);

  const favoriteSet = new Set(favoriteIds);
  return [
    ...locallyOrdered.filter((resource) => favoriteSet.has(resource.id)),
    ...locallyOrdered.filter((resource) => !favoriteSet.has(resource.id)),
  ];
}

export function sortFoldersWithLocalOrder<T extends { id: string; title: string }>(
  resources: readonly T[],
  favoriteIds: readonly string[],
  localOrder: readonly string[],
): T[] {
  return sortResourcesWithLocalOrder(resources, favoriteIds, localOrder);
}

export function sortListsWithLocalOrder<T extends { id: string; title: string }>(
  resources: readonly T[],
  favoriteIds: readonly string[],
  localOrder: readonly string[],
): T[] {
  return sortResourcesWithLocalOrder(resources, favoriteIds, localOrder);
}

export function moveResourceWithinFavoriteGroups<T extends { id: string; title: string }>(
  resources: readonly T[],
  favoriteIds: readonly string[],
  localOrder: readonly string[],
  resourceId: string,
  direction: -1 | 1,
): string[] {
  const displayed = sortResourcesWithLocalOrder(resources, favoriteIds, localOrder);
  const favoriteSet = new Set(favoriteIds);
  const isFavorite = favoriteSet.has(resourceId);
  const group = displayed.filter((resource) => favoriteSet.has(resource.id) === isFavorite);
  const currentIndex = group.findIndex((resource) => resource.id === resourceId);
  const targetIndex = currentIndex + direction;
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= group.length) return displayed.map((resource) => resource.id);

  [group[currentIndex], group[targetIndex]] = [group[targetIndex], group[currentIndex]];
  const favoriteIdsInOrder = favoriteSet.size > 0
    ? displayed.filter((resource) => favoriteSet.has(resource.id)).map((resource) => resource.id)
    : [];
  const regularIdsInOrder = displayed.filter((resource) => !favoriteSet.has(resource.id)).map((resource) => resource.id);
  const nextGroupIds = group.map((resource) => resource.id);

  return isFavorite ? nextGroupIds.concat(regularIdsInOrder) : favoriteIdsInOrder.concat(nextGroupIds);
}
