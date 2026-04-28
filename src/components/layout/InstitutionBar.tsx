import { useInstitution } from "@/contexts/InstitutionContext";
import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Barra horizontal de destaque da instituição/hub atual.
 *
 * Substitui o antigo chip pequeno com botão X que ficava colado ao menu.
 * Aparece apenas em rotas onde faz sentido (Home).
 * - Se não houver instituição selecionada: mostra "Geral".
 * - Se houver várias: pode ser segmentada (Geral | Inglês | Francês).
 * - Selecionada recebe destaque com gradiente da identidade do app.
 */
export function InstitutionBar() {
  const { selectedInstitution, institutions, setSelectedInstitution, loading } = useInstitution();

  if (loading) return null;

  const safeInstitutions = Array.isArray(institutions) ? institutions : [];

  // Sem instituições cadastradas → exibe apenas a faixa "Geral" (informativa)
  if (safeInstitutions.length === 0) {
    return (
      <div className="w-full">
        <div className="max-w-6xl mx-auto px-3 md:px-4 lg:px-8 pt-3">
          <div
            className={cn(
              "w-full rounded-xl border border-primary/30 px-4 py-2.5",
              "bg-gradient-to-r from-primary/15 via-primary/10 to-accent/15",
              "shadow-[0_0_24px_-12px_hsl(var(--primary)/0.4)]",
              "flex items-center justify-center gap-2"
            )}
          >
            <Building2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="text-sm font-semibold tracking-wide text-foreground">
              Geral
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Modo segmentado: 1+ instituições + opção Geral
  // Pequeno fix de exibição: normaliza "Frances" → "Francês" sem alterar dado em DB.
  const prettyName = (name: string) =>
    name.trim().toLowerCase() === "frances" ? "Francês" : name;
  const segments: Array<{ id: string | null; name: string; color?: string | null }> = [
    { id: null, name: "Geral" },
    ...safeInstitutions.map((i) => ({ id: i.id, name: prettyName(i.name), color: i.color })),
  ];

  return (
    <div className="w-full">
      <div className="max-w-6xl mx-auto px-3 md:px-4 lg:px-8 pt-3">
        <div
          role="tablist"
          aria-label="Selecionar instituição"
          className={cn(
            "w-full rounded-2xl border border-primary/25 p-1",
            "bg-card/50 backdrop-blur-md",
            "shadow-[0_0_20px_-10px_hsl(var(--primary)/0.45)]",
            "flex items-center gap-1 overflow-x-auto scrollbar-none"
          )}
        >
          {segments.map((seg) => {
            const isActive =
              (seg.id === null && !selectedInstitution) ||
              (seg.id !== null && selectedInstitution?.id === seg.id);
            return (
              <button
                key={seg.id ?? "__all__"}
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  if (seg.id === null) {
                    setSelectedInstitution(null);
                  } else {
                    const inst = safeInstitutions.find((i) => i.id === seg.id);
                    if (inst) setSelectedInstitution(inst);
                  }
                }}
                className={cn(
                  "relative flex-1 min-w-[88px] px-3 py-2 rounded-xl",
                  "text-sm font-medium whitespace-nowrap transition-all duration-200",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  isActive
                    ? "bg-gradient-to-r from-primary via-primary/80 to-accent text-primary-foreground shadow-[0_4px_20px_-6px_hsl(var(--primary)/0.7)] border border-primary/50"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
                )}
              >
                <span className="flex items-center justify-center gap-2">
                  {seg.color && (
                    <span
                      className="inline-block w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: seg.color }}
                      aria-hidden="true"
                    />
                  )}
                  <span className="truncate">{seg.name}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}