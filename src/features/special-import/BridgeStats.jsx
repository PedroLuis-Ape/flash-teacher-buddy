import { AlertTriangle, CheckCircle2, Copy, FileWarning, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function BridgeStats({ state }) {
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant={state.protocolVersion === "v3" ? "default" : "secondary"}>
        {state.protocolVersion === "v3" ? "JSON oficial v3" : "Formato de compatibilidade"}
      </Badge>
      {state.batchId && <Badge variant="outline" className="max-w-full truncate font-mono text-[10px]">Lote {state.batchId}</Badge>}
    </div>

    {state.warnings.length > 0 && <div className="rounded-lg border border-amber-300/70 bg-amber-50/70 p-3 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
      <div className="mb-1 flex items-center gap-2 font-medium"><AlertTriangle className="h-4 w-4" />Atenção</div>
      {state.warnings.map((warning, index) => <div key={index} className="text-xs">{warning}</div>)}
    </div>}

    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
      <div className="rounded-lg border bg-emerald-50/60 p-3 dark:bg-emerald-950/20">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />Prontos</div>
        <div className="mt-1 text-xl font-bold">{state.stats?.ready ?? 0}</div>
      </div>
      <div className="rounded-lg border bg-sky-50/60 p-3 dark:bg-sky-950/20">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-sky-600" />Já explicados</div>
        <div className="mt-1 text-xl font-bold">{state.stats?.existing ?? 0}</div>
      </div>
      <div className="rounded-lg border bg-amber-50/60 p-3 dark:bg-amber-950/20">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldAlert className="h-3.5 w-3.5 text-amber-600" />Alterados</div>
        <div className="mt-1 text-xl font-bold">{state.stats?.changed ?? 0}</div>
      </div>
      <div className="rounded-lg border p-3">
        <div className="text-xs text-muted-foreground">Faltando no retorno</div>
        <div className="mt-1 text-xl font-bold">{state.missing.length}</div>
      </div>
      <div className="rounded-lg border bg-rose-50/60 p-3 dark:bg-rose-950/20">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileWarning className="h-3.5 w-3.5 text-rose-600" />Problemas</div>
        <div className="mt-1 text-xl font-bold">{state.stats?.problem ?? 0}</div>
      </div>
    </div>

    {state.missing.length > 0 && <Button variant="outline" size="sm" onClick={state.copyMissing}>
      <Copy className="mr-1 h-4 w-4" />
      {state.protocolVersion === "v3" ? "Copiar novo TXT somente dos faltantes" : "Copiar pedido somente dos faltantes"}
    </Button>}

    {(state.stats?.changed ?? 0) > 0 && <div className="rounded-lg border border-amber-300/70 bg-amber-50/70 p-3 text-sm dark:bg-amber-950/20">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <div>
          <div className="font-medium">Cards alterados não serão aplicados</div>
          <p className="mt-1 text-xs text-muted-foreground">O conteúdo ou o foco mudou depois da exportação. Gere um novo TXT para evitar gravar uma explicação desatualizada.</p>
        </div>
      </div>
    </div>}

    {(state.stats?.existing ?? 0) > 0 && <div className="rounded-lg border border-primary/25 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          <div className="text-sm font-medium">A nova importação substitui a explicação anterior</div>
          <p className="mt-1 text-xs text-muted-foreground">O fluxo oficial não acrescenta texto duplicado ao conteúdo existente.</p>
        </div>
      </div>
    </div>}

    {state.busy && state.phase && <div className="rounded-lg border bg-muted/40 p-3 text-sm">
      <div className="font-medium">{state.phase}</div>
      {state.progress && <div className="mt-1 text-xs text-muted-foreground">
        {state.progress.processed} de {state.progress.total} processados
      </div>}
    </div>}
  </div>;
}
