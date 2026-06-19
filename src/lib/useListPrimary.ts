import { useEffect, useState } from "react";
import { loadListPrimarySide } from "./loadListPrimarySide";
import { loadPublicSide } from "./loadPublicSide";

export function useListPrimary(listId: string | null, publicRoute = false) {
  const [side, setSide] = useState<"a" | "b">("a");
  useEffect(() => {
    if (!listId) return;
    let active = true;
    const load = publicRoute ? loadPublicSide : loadListPrimarySide;
    load(listId).then((value) => {
      if (active) setSide(value);
    }).catch(() => {
      if (active) setSide("a");
    });
    return () => { active = false; };
  }, [listId, publicRoute]);
  return side;
}
