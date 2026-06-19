import { useEffect, useState } from "react";
import { loadListPrimarySide } from "./loadListPrimarySide";

export function useListPrimary(listId: string | null) {
  const [side, setSide] = useState<"a" | "b">("a");
  useEffect(() => {
    if (!listId) return;
    let active = true;
    loadListPrimarySide(listId).then((value) => {
      if (active) setSide(value);
    });
    return () => { active = false; };
  }, [listId]);
  return side;
}
