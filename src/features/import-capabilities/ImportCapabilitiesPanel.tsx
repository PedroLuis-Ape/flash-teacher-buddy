import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  capabilityLabel,
  evaluateImportCapabilities,
  type ImportCapabilityKey,
  type ImportCapabilitiesReport,
} from "./capabilities";

interface Props {
  report: ImportCapabilitiesReport | null;
  loading?: boolean;
  requirements: ImportCapabilityKey[];
  onRefresh?: () => void;
}

export function ImportCapabilitiesPanel({ report, loading = false, requirements, onRefresh }: Props) {
  const evaluation = evaluateImportCapabilities(report, requirements);
  const project = report?.projectRef ?? "desconhecido";

  return (
    <Alert variant={evaluation.ready ? "default" : "destructive"}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : evaluation.ready ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
      <AlertTitle>Diagnóstico antecipado do banco</AlertTitle>
      <AlertDescription className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span>Projeto conectado: <strong>{project}</strong></span>
          {report?.engineVersion && <Badge variant="outline">Motor {report.engineVersion}</Badge>}
          {report?.source === "production-basic-compatibility" && <Badge variant="secondary">Compatibilidade básica</Badge>}
          {report?.buildId && <Badge variant="outline">Build {report.buildId}</Badge>}
        </div>
        {report?.source === "production-basic-compatibility" && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
            <strong>Modo básico compatível ativo.</strong> Cards simples podem seguir para análise; o gateway transacional será confirmado antes da gravação. Cards em camadas e campos enriquecidos continuam bloqueados até o RPC unificado ser publicado neste projeto. Um glossário incorporado só será avaliado quando houver entradas válidas.
          </div>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          {requirements.map((key) => {
            const status = report?.capabilities[key] ?? "unknown";
            return (
              <div key={key} className="flex items-center justify-between rounded-md border px-3 py-2">
                <span>{capabilityLabel(key)}</span>
                <Badge variant={status === "ready" ? "secondary" : status === "missing" ? "destructive" : "outline"}>
                  {status === "ready" ? "Disponível" : status === "missing" ? "Ausente" : "Desconhecida"}
                </Badge>
              </div>
            );
          })}
        </div>
        {!evaluation.ready && (
          <div className="space-y-1">
            <p><strong>Importação bloqueada antes da análise.</strong> O app não removerá camadas ou campos para contornar a incompatibilidade.</p>
            {evaluation.failedChecks.slice(0, 3).map((check) => <p key={check.key}>• {check.detail}</p>)}
            <p>Ação recomendada: conferir a migration, o RPC, o grant e a sessão do projeto exibido acima.</p>
          </div>
        )}
        {onRefresh && <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Revalidar ambiente</Button>}
      </AlertDescription>
    </Alert>
  );
}
