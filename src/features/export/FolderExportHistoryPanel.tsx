import { Clock3, History, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { FolderExportHistoryEntry } from "./folderExportHistory";

interface Props {
  entries: FolderExportHistoryEntry[];
  onClear: () => void;
}

const formatLabels: Record<FolderExportHistoryEntry["format"], string> = {
  txt: "TXT baixado",
  json: "JSON baixado",
  "copy-txt": "TXT copiado",
  "copy-json": "JSON copiado",
};

export function FolderExportHistoryPanel({ entries, onClear }: Props) {
  if (entries.length === 0) return null;

  return (
    <section className="rounded-xl border bg-muted/20 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Exportações recentes</h3>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onClear}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Limpar
        </Button>
      </div>
      <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
        {entries.slice(0, 6).map((entry) => (
          <div key={entry.id} className="rounded-lg border bg-background/70 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong className="min-w-0 truncate">
                {entry.folders.map((folder) => folder.title).join(", ")}
              </strong>
              <span className="shrink-0 text-muted-foreground">{formatLabels[entry.format]}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock3 className="h-3 w-3" />
                {new Date(entry.exportedAt).toLocaleString("pt-BR")}
              </span>
              <span>{entry.summary.lists.toLocaleString("pt-BR")} listas</span>
              <span>{entry.summary.cards.toLocaleString("pt-BR")} cards</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
