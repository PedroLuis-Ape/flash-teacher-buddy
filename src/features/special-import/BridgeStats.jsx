import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function BridgeStats({ state }) {
  return <>
    {state.warnings.map((warning, index) => <div key={index} className="text-xs text-amber-600">⚠️ {warning}</div>)}
    <div className="flex flex-wrap gap-2">
      <Badge>Prontos: {state.stats?.ready}</Badge>
      <Badge variant="secondary">Já explicados: {state.stats?.existing}</Badge>
      {state.missing.length > 0 && <Badge variant="destructive">Faltando: {state.missing.length}</Badge>}
      {state.stats?.problem > 0 && <Badge variant="destructive">Problemas: {state.stats.problem}</Badge>}
    </div>
    {state.stats?.existing > 0 && <div className="flex flex-wrap gap-2">
      <Button size="sm" variant={state.mode === "replace" ? "default" : "outline"} onClick={() => state.setMode("replace")}>Substituir</Button>
      <Button size="sm" variant={state.mode === "append" ? "default" : "outline"} onClick={() => state.setMode("append")}>Acrescentar</Button>
      <Button size="sm" variant={state.mode === "skip" ? "default" : "outline"} onClick={() => state.setMode("skip")}>Ignorar existentes</Button>
    </div>}
  </>;
}
