import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const STATUS = {
  found: { label: "Pronto", variant: "default" },
  existing: { label: "Substituirá", variant: "secondary" },
  changed: { label: "Alterado", variant: "outline" },
  invalid: { label: "Inválido", variant: "destructive" },
  duplicate: { label: "Duplicado", variant: "destructive" },
  outside: { label: "Fora do lote", variant: "destructive" },
  "missing-db": { label: "Não encontrado", variant: "destructive" },
};

export default function BridgeRows({ rows }) {
  return <ScrollArea className="min-h-[260px] flex-1 rounded-lg border">
    <div className="divide-y">{rows.map((row, index) => {
      const status = STATUS[row.status] || { label: row.status, variant: "outline" };
      return <div key={`${row.id || row.item?.item_id || row.item?.card_ref || "row"}-${index}`} className="space-y-2 p-3 text-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="break-words font-medium">
              {row.item?.term || row.item?.card_ref || "Item não reconciliado"}
              {row.item?.translation && <span className="font-normal text-muted-foreground"> → {row.item.translation}</span>}
            </div>
            {row.id && <div className="mt-0.5 break-all font-mono text-[10px] text-muted-foreground">Card: {row.id}</div>}
            {row.item?.item_id && <div className="break-all font-mono text-[10px] text-muted-foreground">Item: {row.item.item_id}</div>}
          </div>
          <Badge variant={status.variant} className="shrink-0">{status.label}</Badge>
        </div>
        {row.item?.detailed_explanation && <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">
          {row.item.detailed_explanation}
        </p>}
        {row.reason && <div className={`rounded px-2 py-1 text-xs ${row.status === "changed" ? "bg-amber-500/10 text-amber-700 dark:text-amber-300" : "bg-destructive/10 text-destructive"}`}>{row.reason}</div>}
        {(row.warnings || []).map((warning, warningIndex) => <div key={warningIndex} className="text-xs text-amber-600">⚠️ {warning}</div>)}
      </div>;
    })}</div>
  </ScrollArea>;
}
