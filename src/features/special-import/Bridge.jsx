import { CheckCircle2, FileSearch, Loader2, Sparkles, UploadCloud } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import BridgeInput from "./BridgeInput";
import BridgeStats from "./BridgeStats";
import BridgeRows from "./BridgeRows";
import { useBridgeState } from "./useBridgeState";

export default function Bridge({ open, onOpenChange, userId }) {
  const state = useBridgeState(userId);
  const close = (value) => {
    onOpenChange(value);
    if (!value) state.reset();
  };
  const canApply = state.rows?.some((row) => row.status === "found" || (row.status === "existing" && state.mode !== "skip"));
  const step = state.report ? 3 : state.rows ? 2 : 1;
  const steps = [
    { icon: UploadCloud, label: "Carregar", value: 1 },
    { icon: FileSearch, label: "Conferir", value: 2 },
    { icon: CheckCircle2, label: "Concluir", value: 3 },
  ];

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="flex max-h-[92vh] max-w-4xl flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 text-xl">
          <Sparkles className="h-5 w-5 text-sky-500" />
          Importar explicações dos Cards Especiais
        </DialogTitle>
        <DialogDescription>Carregue o retorno da IA, confira os cards e aplique as explicações.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-3 gap-2 rounded-xl border bg-muted/30 p-2 text-xs">
        {steps.map((item) => {
          const Icon = item.icon;
          const active = step >= item.value;
          return <div key={item.value} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 font-medium ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
            <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
            {item.label}
          </div>;
        })}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {!state.rows ? <BridgeInput state={state} /> : <div className="space-y-4">
          <BridgeStats state={state} />
          <BridgeRows rows={state.rows} />
          {state.report && <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-100">
            <div className="mb-1 flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />Importação concluída</div>
            {state.report}
          </div>}
        </div>}
      </div>

      <DialogFooter className="gap-2 sm:gap-2">
        {state.rows && !state.report && <Button variant="outline" onClick={() => state.setRows(null)} disabled={state.busy}>Voltar</Button>}
        <Button variant="ghost" onClick={() => close(false)}>{state.report ? "Fechar" : "Cancelar"}</Button>
        {state.rows && !state.report && <Button onClick={state.apply} disabled={state.busy || !canApply}>
          {state.busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Aplicar e remover da fila
        </Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
