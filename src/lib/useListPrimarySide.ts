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
    setState((current) => ({ ...current, loading: true }));
    const load = publicRoute ? loadPublicListPrimarySide : loadListPrimarySide;

    load(listId)
      .then((side) => {
        if (active) setState({ side, loading: false });
      })
      .catch(() => {
        if (active) setState({ side: "a", loading: false });
      });

    return () => {
      active = false;
    };
  }, [listId, publicRoute]);

  return state;
}
