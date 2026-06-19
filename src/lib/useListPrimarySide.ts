import { useEffect, useState } from "react";
import { loadListPrimarySide } from "./loadListPrimarySide";
import { loadPublicListPrimarySide } from "./loadPublicListPrimarySide";

export function useListPrimarySide(listId: string | null, publicRoute = false) {
  const [state, setState] = useState({ side: "a" as "a" | "b", loading: !!listId });

  useEffect(() => {
    if (!listId) {
      setState({ side: "a", loading: false });
      return;
    }

    let active = true;
    const load = publicRoute ? loadPublicListPrimarySide : loadListPrimarySide;

    const refresh = () => {
      setState((current) => ({ ...current, loading: true }));
      load(listId)
        .then((side) => {
          if (active) setState({ side, loading: false });
        })
        .catch(() => {
          if (active) setState({ side: "a", loading: false });
        });
    };

    const handlePreferenceChange = (event: Event) => {
      const detail = (event as CustomEvent<{ listId?: string; side?: "a" | "b" }>).detail;
      if (detail?.listId !== listId || !detail.side) return;
      setState({ side: detail.side, loading: false });
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== `ape_list_primary_side:v1:${listId}`) return;
      refresh();
    };

    refresh();
    window.addEventListener("ape-list-primary-side-change", handlePreferenceChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      active = false;
      window.removeEventListener("ape-list-primary-side-change", handlePreferenceChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [listId, publicRoute]);

  return state;
}
