import { CheckCircle2, FileCheck2, FileJson, Loader2, Sparkles, UploadCloud } from "lucide-react";
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
  const canApply = state.rows?.some((row) => row.status === "found" || row.status === "existing");
  const step = state.report ? 4 : state.rows && state.busy ? 3 : state.rows ? 2 : 1;
  const steps = [
    { icon: UploadCloud, label: "Carregar JSON", value: 1 },
    { icon: FileCheck2, label: "Conferir", value: 2 },
    { icon: Sparkles, label: "Aplicar", value: 3 },
    { icon: CheckCircle2, label: "Concluir", value: 4 },
  ];

  return <Dialog open={open} onOpenChange={close}>
    <DialogContent className="grid max-h-[calc(100dvh-1rem)] max-w-4xl grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-h-[92vh] sm:gap-4 sm:p-6">
      <DialogHeader className="border-b px-5 pb-4 pt-5 text-left sm:border-0 sm:p-0">
        <DialogTitle className="flex items-center gap-2 text-xl">
          <FileJson className="h-5 w-5 text-sky-500" />
          Importar explicações dos Cards Especiais
        </DialogTitle>
        <DialogDescription>Carregue o JSON devolvido pela IA, confira cada card e aplique somente os itens seguros.</DialogDescription>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-2 border-b px-5 py-3 text-xs sm:grid-cols-4 sm:rounded-xl sm:border sm:bg-muted/30 sm:p-2">
        {steps.map((item) => {
          const Icon = item.icon;
          const active = step >= item.value;
          return <div key={item.value} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 font-medium ${active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
            <Icon className={`h-4 w-4 ${active ? "text-primary" : ""}`} />
            {item.label}
          </div>;
        })}
      </div>

      <div className="min-h-0 overflow-y-auto overscroll-contain px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-0 sm:py-0 sm:pb-0">
        {!state.rows ? <BridgeInput state={state} /> : <div className="space-y-4">
          <BridgeStats state={state} />
          <BridgeRows rows={state.rows} />
          {state.report && <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-100">
            <div className="mb-1 flex items-center gap-2 font-semibold"><CheckCircle2 className="h-4 w-4" />Importação concluída</div>
            {state.report}
          </div>}
        </div>}
      </div>

      <DialogFooter className="gap-2 border-t bg-background px-5 py-3 sm:border-0 sm:p-0">
        {state.rows && !state.report && <Button variant="outline" onClick={() => state.setRows(null)} disabled={state.busy}>Voltar</Button>}
        <Button variant="ghost" onClick={() => close(false)}>{state.report ? "Fechar" : "Cancelar"}</Button>
        {state.rows && !state.report && <Button onClick={state.apply} disabled={state.busy || !canApply}>
          {state.busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Aplicar itens válidos
        </Button>}
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
