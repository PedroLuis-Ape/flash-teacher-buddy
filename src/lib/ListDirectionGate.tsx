import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { listIdFromPath } from "./listRoute";
import { loadListPrimarySide } from "./loadListPrimarySide";
import { loadPublicSide } from "./loadPublicSide";
import { primarySideToDirection } from "./primarySideDirection";

export function ListDirectionGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const listId = listIdFromPath(location.pathname);
  const publicRoute = location.pathname.startsWith("/portal/list/");
  const params = new URLSearchParams(location.search);
  const explicit = params.has("dir") || params.has("direction");
  const query = useQuery({
    queryKey: ["list-primary-side", listId, publicRoute],
    queryFn: () => publicRoute ? loadPublicSide(listId!) : loadListPrimarySide(listId!),
    enabled: !!listId && !explicit,
    staleTime: 300_000,
  });

  if (!listId || explicit) return <>{children}</>;
  if (query.isLoading) {
    return <div className="min-h-[50vh] grid place-items-center text-sm text-muted-foreground">Preparando direção da lista...</div>;
  }
  params.set("dir", primarySideToDirection(query.data ?? "a"));
  return <Navigate replace to={{ pathname: location.pathname, search: params.toString() }} />;
}
