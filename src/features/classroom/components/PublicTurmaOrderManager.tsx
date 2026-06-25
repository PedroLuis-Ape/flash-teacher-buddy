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
import { floatingOrderActionClass } from "@/features/classroom/lib/floatingOrderAction";
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

interface PublicTurma extends OrderedPublicTurma {
  nome: string;
  descricao?: string | null;
}

interface PublicTurmaOrderManagerProps {
  turmas: PublicTurma[];
}

export function PublicTurmaOrderManager({ turmas }: PublicTurmaOrderManagerProps) {
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
        size="sm"
        className={floatingOrderActionClass}
        onClick={() => setOpen(true)}
        aria-label="Organizar turmas públicas"
      >
        <ListOrdered className="h-4 w-4" />
        Organizar turmas públicas
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe2 className="h-5 w-5 text-primary" />
              Ordem das turmas públicas
            </DialogTitle>
            <DialogDescription>
              Defina qual turma aparece primeiro no seu perfil público. A posição 001 será exibida no topo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            {draftTurmas.map((turma, index) => (
              <div key={turma.id} className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
                <Select value={String(index)} onValueChange={(value) => moveToPosition(turma.id, Number(value))}>
                  <SelectTrigger
                    className="h-10 w-24 shrink-0 border-primary/30 font-mono font-bold text-primary"
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

                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold">{turma.nome}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Globe2 className="h-3 w-3" /> Pública
                    </Badge>
                    {turma.descricao && (
                      <span className="line-clamp-1 text-xs text-muted-foreground">{turma.descricao}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-1 self-end sm:self-auto">
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              type="button"
              className="gap-2"
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
