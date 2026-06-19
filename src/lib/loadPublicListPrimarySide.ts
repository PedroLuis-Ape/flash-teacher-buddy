import { loadListPrimarySide } from "./loadListPrimarySide";

export async function loadPublicListPrimarySide(listId: string): Promise<"a" | "b"> {
  return loadListPrimarySide(listId);
}
