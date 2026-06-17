import { ScrollArea } from "@/components/ui/scroll-area";

export default function BridgeRows({ rows }) {
  return <ScrollArea className="flex-1 min-h-[230px] border rounded-md">
    <div className="divide-y">{rows.map((row, index) => <div key={`${row.id}-${index}`} className="p-3 text-sm">
      <div className="font-medium">{row.item?.term || row.item?.card_ref || "Item inválido"}</div>
      {row.id && <div className="text-[11px] font-mono text-muted-foreground break-all">{row.id}</div>}
      {row.reason && <div className="text-xs text-destructive">{row.reason}</div>}
      {(row.warnings || []).map((warning, i) => <div key={i} className="text-xs text-amber-600">⚠️ {warning}</div>)}
    </div>)}</div>
  </ScrollArea>;
}
