import { useInstitution } from "@/contexts/InstitutionContext";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Indicador discreto do contexto atual (instituição/hub ativo).
 *
 * NÃO é mais um seletor — a troca de instituição acontece pelo menu lateral
 * (AppSidebar → seção "Hubs"). Aqui exibimos apenas uma linha sutil com
 * o nome da instituição ativa, para orientação visual.
 *
 * Regras:
 * - Sem instituições cadastradas → nada é renderizado.
 * - Filtro "Geral" (nenhuma selecionada) → nada é renderizado (estado neutro).
 * - Instituição selecionada → linha discreta "Instituição: Nome".
 */
export function InstitutionBar() {
  const { selectedInstitution, institutions, loading } = useInstitution();

  if (loading) return null;

  const safeInstitutions = Array.isArray(institutions) ? institutions : [];

  // Sem instituições, ou nenhuma instituição selecionada → nada para mostrar.
  // O usuário troca tudo pelo menu lateral; o topo permanece limpo.
  if (safeInstitutions.length === 0 || !selectedInstitution) return null;

  const prettyName =
    selectedInstitution.name.trim().toLowerCase() === "frances"
      ? "Francês"
      : selectedInstitution.name;

  return (
    <div className="w-full">
      <div
        className={cn(
          "max-w-[1600px] mx-auto px-3 md:px-4 lg:px-8 pt-2 pb-1",
          "flex items-center justify-center gap-2",
          "text-xs text-muted-foreground"
        )}
      >
        <Building2 className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
        {selectedInstitution.color && (
          <span
            className="inline-block w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: selectedInstitution.color }}
            aria-hidden="true"
          />
        )}
        <span className="truncate">
          Instituição atual:{" "}
          <span className="font-medium text-foreground">{prettyName}</span>
        </span>
      </div>
    </div>
  );
}