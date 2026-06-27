import { naturalSort } from "@/lib/sorting";

export interface MarkableList {
  id: string;
  title: string;
}

export function sortListsWithFavoritesFirst<T extends MarkableList>(
  lists: readonly T[],
  favoriteIds: readonly string[],
): T[] {
  const favoriteSet = new Set(favoriteIds);
  const alphabetical = naturalSort([...lists], (list) => list.title);

  return alphabetical.sort((left, right) => {
    const leftFavorite = favoriteSet.has(left.id);
    const rightFavorite = favoriteSet.has(right.id);
    if (leftFavorite === rightFavorite) return 0;
    return leftFavorite ? -1 : 1;
  });
}
