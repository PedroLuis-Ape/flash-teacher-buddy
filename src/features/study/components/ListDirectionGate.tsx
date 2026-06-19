import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate, useLocation, useParams } from "react-router-dom";
import { loadListPrimarySide } from "@/lib/loadListPrimarySide";
import { loadPublicListPrimarySide } from "@/lib/loadPublicListPrimarySide";
import { primarySideToDirection } from "@/lib/primarySideDirection";

function validDirection(value: string | null): boolean {
  return value === "a-b" || value === "b-a" || value === "any";
}

export function ListDirectionGate({ children }: { children: ReactNode }) {
  const { id } = useParams();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const explicit = params.get("dir") || params.get("direction");
  const publicRoute = location.pathname.startsWith("/portal/list/");

  const query = useQuery({
    queryKey: ["list-primary-side", id, publicRoute],
    queryFn: () => publicRoute ? loadPublicListPrimarySide(id!) : loadListPrimarySide(id!),
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
