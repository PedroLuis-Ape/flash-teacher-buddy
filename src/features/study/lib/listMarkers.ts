import { naturalSort } from "@/lib/sorting";

export interface MarkableResource {
  id: string;
  title: string;
}

export function sortResourcesWithFavoritesFirst<T extends MarkableResource>(
  resources: readonly T[],
  favoriteIds: readonly string[],
): T[] {
  const favoriteSet = new Set(favoriteIds);
  const alphabetical = naturalSort([...resources], (resource) => resource.title);

  return alphabetical.sort((left, right) => {
    const leftFavorite = favoriteSet.has(left.id);
    const rightFavorite = favoriteSet.has(right.id);
    if (leftFavorite === rightFavorite) return 0;
    return leftFavorite ? -1 : 1;
  });
}

export const sortListsWithFavoritesFirst = sortResourcesWithFavoritesFirst;
