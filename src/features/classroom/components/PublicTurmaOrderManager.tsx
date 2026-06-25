import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Globe2, ListOrdered, Save } from "lucide-react";
import { toast } from "sonner";
import { useReorderPublicTurmas } from "@/features/classroom/hooks/useTurmas";
import {
  movePublicTurmaToPosition,
  publicTurmaPositionLabel,
  sortPublicTurmasByOrder,
  type OrderedPublicTurma,
} from "@/features/classroom/lib/publicTurmaOrder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface PublicTurma extends OrderedPublicTurma {
  nome: string;
  descricao?: string | null;
}

interface PublicTurmaOrderManagerProps {
  turmas: PublicTurma[];
  className?: string;
}

export function PublicTurmaOrderManager({ turmas, className }: PublicTurmaOrderManagerProps) {
  const [open, setOpen] = useState(false);
  const [draftIds, setDraftIds] = useState<string[]>([]);
  const reorderPublicTurmas = useReorderPublicTurmas();

  const publicTurmas = useMemo(
    () => sortPublicTurmasByOrder(
      turmas.filter((turma) => turma.public === true && turma.ativo !== false),
    ),
    [turmas],
  );

  const turmaMap = useMemo(
    () => new Map(publicTurmas.map((turma) => [turma.id, turma])),
    [publicTurmas],
  );
  const currentIds = useMemo(() => publicTurmas.map((turma) => turma.id), [publicTurmas]);
  const draftTurmas = draftIds.map((id) => turmaMap.get(id)).filter(Boolean) as PublicTurma[];
  const normalized = publicTurmas.every(
    (turma, index) => Number(turma.public_order_index ?? 0) === index + 1,
  );
  const hasChanged = draftIds.join("|") !== currentIds.join("|") || !normalized;

  useEffect(() => {
    if (open) setDraftIds(currentIds);
  }, [open, currentIds]);

  if (publicTurmas.length < 2) return null;

  const moveToPosition = (turmaId: string, targetIndex: number) => {
    const base = draftTurmas.length === publicTurmas.length ? draftTurmas : publicTurmas;
    const next = movePublicTurmaToPosition(base, turmaId, targetIndex);
    setDraftIds(next.map((turma) => turma.id));
  };

  const saveOrder = async () => {
    const orderedIds = draftIds.length === publicTurmas.length ? draftIds : currentIds;
    try {
      await reorderPublicTurmas.mutateAsync({ ordered_ids: orderedIds });
      toast.success("Ordem das turmas públicas atualizada!");
      setOpen(false);
    } catch (error) {
      console.error("[PublicTurmaOrderManager] Failed to save order:", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a ordem das turmas.");
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className={cn(
          "h-11 w-full justify-center gap-2 rounded-xl border-primary/30 px-3 text-sm sm:w-auto",
          className,
        )}
        onClick={() => setOpen(true)}
        aria-label="Organizar turmas públicas"
      >
        <ListOrdered className="h-4 w-4" />
        <span className="truncate">Organizar turmas públicas</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88svh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto rounded-2xl p-4 sm:w-full sm:p-6">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Globe2 className="h-5 w-5 shrink-0 text-primary" />
              Ordem das turmas públicas
            </DialogTitle>
            <DialogDescription className="text-xs leading-relaxed sm:text-sm">
              Defina qual turma aparece primeiro no seu perfil público. A posição 001 será exibida no topo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-1 sm:py-2">
            {draftTurmas.map((turma, index) => (
              <div
                key={turma.id}
                className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border bg-card p-2.5 sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:gap-3 sm:p-3"
              >
                <Select value={String(index)} onValueChange={(value) => moveToPosition(turma.id, Number(value))}>
                  <SelectTrigger
                    className="h-9 w-[4.5rem] shrink-0 border-primary/30 px-2 font-mono text-xs font-bold text-primary sm:h-10 sm:w-24 sm:text-sm"
                    aria-label={`Posição de ${turma.nome}`}
                  >
                    <SelectValue>{publicTurmaPositionLabel(index)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {draftTurmas.map((_item, positionIndex) => (
                      <SelectItem key={positionIndex} value={String(positionIndex)}>
                        {publicTurmaPositionLabel(positionIndex)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold sm:text-base" title={turma.nome}>{turma.nome}</p>
                  <div className="mt-1 flex min-w-0 items-center gap-2">
                    <Badge variant="outline" className="hidden shrink-0 gap-1 sm:inline-flex">
                      <Globe2 className="h-3 w-3" /> Pública
                    </Badge>
                    {turma.descricao && (
                      <span className="truncate text-[11px] text-muted-foreground sm:text-xs">{turma.descricao}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 sm:h-9 sm:w-9"
                    disabled={index === 0}
                    onClick={() => moveToPosition(turma.id, index - 1)}
                    aria-label={`Mover ${turma.nome} para cima`}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8 sm:h-9 sm:w-9"
                    disabled={index === draftTurmas.length - 1}
                    onClick={() => moveToPosition(turma.id, index + 1)}
                    aria-label={`Mover ${turma.nome} para baixo`}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="w-full gap-2 sm:w-auto"
              disabled={!hasChanged || reorderPublicTurmas.isPending}
              onClick={saveOrder}
            >
              <Save className="h-4 w-4" />
              {reorderPublicTurmas.isPending ? "Salvando..." : "Salvar ordem"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
