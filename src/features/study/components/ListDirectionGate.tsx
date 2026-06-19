import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { loadListPrimarySide } from "@/lib/loadListPrimarySide";
import { loadPublicListPrimarySide } from "@/lib/loadPublicListPrimarySide";
import { getOfflineList } from "@/lib/offlineStore";
import { primarySideToDirection } from "@/lib/primarySideDirection";

function validDirection(value: string | null): boolean {
  return value === "a-b" || value === "b-a" || value === "any";
}

async function resolvePrimarySide(listId: string, publicRoute: boolean): Promise<"a" | "b"> {
  try {
    return publicRoute
      ? await loadPublicListPrimarySide(listId)
      : await loadListPrimarySide(listId);
  } catch {
    const offline = await getOfflineList(listId).catch(() => null);
    const primarySide = (offline?.listMeta as { primary_side?: string } | undefined)?.primary_side;
    return primarySide === "b" ? "b" : "a";
  }
}

export function ListDirectionGate({ children }: { children: ReactNode }) {
  const { id } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const explicit = params.get("dir") || params.get("direction");
  const publicRoute = location.pathname.startsWith("/portal/list/");

  const query = useQuery({
    queryKey: ["list-primary-side", id, publicRoute],
    queryFn: () => resolvePrimarySide(id!, publicRoute),
    enabled: !!id && !validDirection(explicit),
    staleTime: 0,
    refetchOnMount: "always",
    retry: 1,
  });

  if (validDirection(explicit)) return <>{children}</>;

  if (query.isPending) {
    return (
      <div className="min-h-[50vh] grid place-items-center text-sm text-muted-foreground">
        Preparando a direção da lista...
      </div>
    );
  }

  params.delete("direction");
  params.set("dir", primarySideToDirection(query.data));

  return <Navigate replace to={{ pathname: location.pathname, search: params.toString() }} />;
}
