export function getFolderListGamesPath(listId: string, isPublicPortal: boolean): string {
  return `${isPublicPortal ? "/portal/list" : "/list"}/${listId}/games`;
}
