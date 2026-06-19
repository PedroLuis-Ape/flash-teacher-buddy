import { supabase } from "@/integrations/supabase/client";
import { listIdFromPath } from "./listRoute";

export type StoredPrimarySide = "a" | "b";

type ListWithPrimarySide = { primary_side?: string };

const storageKey = (listId: string) => `ape_list_primary_side:v1:${listId}`;

export function readLocalListPrimarySide(listId: string): StoredPrimarySide | null {
  try {
    const value = localStorage.getItem(storageKey(listId));
    return value === "a" || value === "b" ? value : null;
  } catch {
    return null;
  }
}

function writeLocalListPrimarySide(listId: string, side: StoredPrimarySide) {
  try {
    localStorage.setItem(storageKey(listId), side);
  } catch {
    // Private browsing or storage quota: runtime can still continue with side A.
  }
}

export async function loadListPrimarySide(listId: string): Promise<StoredPrimarySide> {
  const localSide = readLocalListPrimarySide(listId);
  const result = await supabase.from("lists").select("*").eq("id", listId).maybeSingle();

  if (!result.error) {
    const remoteValue = (result.data as ListWithPrimarySide | null)?.primary_side;
    if (remoteValue === "a" || remoteValue === "b") {
      writeLocalListPrimarySide(listId, remoteValue);
      return remoteValue;
    }
  }

  return localSide ?? "a";
}

export async function saveListPrimarySide(listId: string, side: StoredPrimarySide): Promise<void> {
  writeLocalListPrimarySide(listId, side);
  window.dispatchEvent(new CustomEvent("ape-list-primary-side-change", {
    detail: { listId, side },
  }));

  const { error } = await supabase
    .from("lists")
    .update({ primary_side: side } as any)
    .eq("id", listId);

  if (error && import.meta.env.DEV) {
    console.warn("[primary-side] Remote persistence unavailable; local preference kept.", error.message);
  }
}

export function persistListPrimarySideFromCurrentRoute(side: unknown): void {
  const listId = listIdFromPath(window.location.pathname);
  if (!listId) return;
  void saveListPrimarySide(listId, side === "b" ? "b" : "a");
}
