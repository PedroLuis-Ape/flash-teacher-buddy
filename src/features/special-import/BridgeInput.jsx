import { useRef } from "react";
import { FileCheck2, FileJson, Loader2, ShieldCheck, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function BridgeInput({ state }) {
  const fileRef = useRef(null);
  const chooseFile = () => fileRef.current?.click();
  const handleDrop = (event) => {
    event.preventDefault();
    state.loadFile(event.dataTransfer.files?.[0]);
  };

  return <div className="space-y-4">
    <div className="rounded-xl border border-primary/25 bg-primary/5 p-3 text-sm">
      <div className="flex items-start gap-2">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <div className="font-medium">Formato oficial: JSON v3</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Importe exatamente o objeto JSON devolvido pela IA. O app confere lote, IDs, duplicações e alterações feitas depois da exportação.
          </p>
        </div>
      </div>
    </div>

    <input
      ref={fileRef}
      type="file"
      accept=".json,application/json,.txt,text/plain,.csv,text/csv"
      className="hidden"
      onChange={(event) => {
        state.loadFile(event.target.files?.[0]);
        event.currentTarget.value = "";
      }}
    />

    <button
      type="button"
      onClick={chooseFile}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      className="w-full rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 px-5 py-7 text-center transition hover:border-primary/60 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <UploadCloud className="mx-auto mb-2 h-8 w-8 text-primary" />
      <div className="font-semibold">Carregue o JSON devolvido pela IA</div>
      <div className="mt-1 text-sm text-muted-foreground">Arraste o arquivo aqui ou clique para escolher</div>
      <div className="mt-1 text-xs text-muted-foreground">CSV e JSON antigos continuam aceitos apenas por compatibilidade.</div>
      {state.fileName && <div className="mx-auto mt-3 flex w-fit max-w-full items-center gap-2 rounded-full bg-background px-3 py-1 text-xs font-medium shadow-sm">
        <FileCheck2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
        <span className="truncate">{state.fileName}</span>
      </div>}
    </button>

    <div className="relative flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      ou cole o JSON
      <div className="h-px flex-1 bg-border" />
    </div>

    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileJson className="h-4 w-4" />
        Conteúdo recebido
      </div>
      <Textarea
        value={state.raw}
        onChange={(event) => {
          state.setRaw(event.target.value);
          state.setRows(null);
        }}
        className="min-h-[250px] resize-y font-mono text-xs"
        placeholder={'{"schema":"app-piteco-special-cards-result","version":"3.0","export_id":"...","batch_id":"...","items":[...]}' }
        spellCheck={false}
      />
    </div>

    {state.busy && state.phase && <div className="rounded-lg border bg-muted/40 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium">
        <Loader2 className="h-4 w-4 animate-spin" />
        {state.phase}
      </div>
      {state.progress && <div className="mt-1 text-xs text-muted-foreground">
        {state.progress.processed} de {state.progress.total}
      </div>}
    </div>}

    <Button onClick={state.validate} disabled={state.busy || !state.raw.trim()} className="w-full sm:w-auto sm:float-right">
      {state.busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
      Validar JSON e conferir lote
    </Button>
  </div>;
}
