import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

function validDirection(value: string | null): boolean {
  return value === "a-b" || value === "b-a" || value === "any";
}

/**
 * Guarantees a canonical direction token on list game/study routes.
 *
 * The global default is deliberately `any`: every mode alternates which side
 * appears as the prompt. A fixed side is only used when the student explicitly
 * chooses A → B or B → A in the game hub (or receives an explicit deep link).
 */
export function ListDirectionGate({ children }: { children: ReactNode }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const explicit = params.get("dir") || params.get("direction");

  if (validDirection(explicit)) return <>{children}</>;

  params.delete("direction");
  params.set("dir", "any");

  return <Navigate replace to={{ pathname: location.pathname, search: params.toString() }} />;
}
