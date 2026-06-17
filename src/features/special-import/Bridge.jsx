import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import BridgeInput from "./BridgeInput";
import BridgeStats from "./BridgeStats";
import BridgeRows from "./BridgeRows";
import { useBridgeState } from "./useBridgeState";

export default function Bridge({ open, onOpenChange, userId }) {
  const state = useBridgeState(userId);
  const close = (value) => { onOpenChange(value); if (!value) state.reset(); };
  const canApply = state.rows?.some((row) => row.status === "found" || (row.status === "existing" && state.mode !== "skip"));

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Importar explicações da IA</DialogTitle>
        <DialogDescription>Cole a resposta ou carregue um arquivo. O app confere IDs, duplicados e cards faltantes antes de gravar.</DialogDescription>
      </DialogHeader>
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        {!state.rows ? <BridgeInput state={state} /> : <>
          <BridgeStats state={state} />
          <BridgeRows rows={state.rows} />
          {state.report && <div className="p-3 border rounded-md bg-muted/30 text-sm">{state.report}</div>}
        </>}
      </div>
      <DialogFooter>
        {state.rows && !state.report && <Button variant="outline" onClick={() => state.setRows(null)}>Voltar</Button>}
        <Button variant="ghost" onClick={() => close(false)}>{state.report ? "Fechar" : "Cancelar"}</Button>
        {state.rows && !state.report && <Button onClick={state.apply} disabled={state.busy || !canApply}>{state.busy && <Loader2 className="h-4 w-4 animate-spin mr-1" />}Aplicar válidas</Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
