import { useRef } from "react";
import { FileCheck2, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
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
    <input
      ref={fileRef}
      type="file"
      accept=".csv,.json,.txt,text/csv,application/json,text/plain"
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
      <div className="font-semibold">Carregue o arquivo devolvido pela IA</div>
      <div className="mt-1 text-sm text-muted-foreground">Arraste aqui ou clique para escolher CSV, JSON ou TXT</div>
      {state.fileName && <div className="mx-auto mt-3 flex w-fit items-center gap-2 rounded-full bg-background px-3 py-1 text-xs font-medium shadow-sm">
        <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
        {state.fileName}
      </div>}
    </button>

    <div className="relative flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground">
      <div className="h-px flex-1 bg-border" />
      ou cole o conteúdo
      <div className="h-px flex-1 bg-border" />
    </div>

    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <FileSpreadsheet className="h-4 w-4" />
        Conteúdo recebido
      </div>
      <Textarea
        value={state.raw}
        onChange={(event) => {
          state.setRaw(event.target.value);
          if (state.fileName) state.setRows(null);
        }}
        className="min-h-[230px] font-mono text-xs"
        placeholder={'"format","schema_version","export_id",...'}
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
      Analisar e conferir arquivo
    </Button>
  </div>;
}
