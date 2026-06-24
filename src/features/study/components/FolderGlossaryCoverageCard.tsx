import { useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileUp,
  Loader2,
  RefreshCw,
  ScanSearch,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFolderGlossary } from "@/hooks/useFolderGlossary";
import { parseFolderGlossaryJson } from "@/features/study/lib/folderGlossaryTransfer";
import {
  loadFolderGlossaryCoverage,
  serializeMissingCoverageTerms,
  serializeUsedCoverageEntries,
  type FolderGlossaryCoverageReport,
  type FolderGlossaryCoverageStatus,
} from "@/features/study/lib/folderGlossaryCoverage";

interface Props {
  folderId: string;
  folderTitle: string;
  labelA: string;
  labelB: string;
}

const statusLabels: Record<FolderGlossaryCoverageStatus, string> = {
  covered: "No glossário",
  expression: "Coberta por expressão",
  inactive: "Entrada inativa",
  wrong_side: "Lado oposto",
  missing: "Ausente",
};

const statusClasses: Record<FolderGlossaryCoverageStatus, string> = {
  covered: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600",
  expression: "border-sky-500/30 bg-sky-500/10 text-sky-600",
  inactive: "border-amber-500/30 bg-amber-500/10 text-amber-600",
  wrong_side: "border-orange-500/30 bg-orange-500/10 text-orange-600",
  missing: "border-destructive/30 bg-destructive/10 text-destructive",
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "pasta";
}

function downloadJson(content: string, fileName: string) {
  const blob = new Blob([content], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function FolderGlossaryCoverageCard({
  folderId,
  folderTitle,
  labelA,
  labelB,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { entries, canEdit, isLoading: glossaryLoading, importEntries } = useFolderGlossary(folderId);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<FolderGlossaryCoverageReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | FolderGlossaryCoverageStatus>("missing");

  const runAudit = async () => {
    if (loading || glossaryLoading) return;
    setLoading(true);
    setError(null);
    try {
      const next = await loadFolderGlossaryCoverage(folderId, entries);
      setReport(next);
      if (next.missingTerms === 0 && next.inactiveTerms === 0 && next.wrongSideTerms === 0) {
        setStatusFilter("all");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível auditar o glossário.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !report && !loading && !glossaryLoading) void runAudit();
  };

  const filteredTerms = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!report) return [];
    return report.terms.filter((term) => {
      if (statusFilter !== "all" && term.status !== statusFilter) return false;
      if (!query) return true;
      return term.term.toLocaleLowerCase().includes(query)
        || term.examples.some((example) => example.text.toLocaleLowerCase().includes(query));
    });
  }, [report, search, statusFilter]);

  const coveragePercent = report && report.totalOccurrences > 0
    ? Math.round((report.coveredOccurrences / report.totalOccurrences) * 100)
    : 0;

  const exportPending = () => {
    if (!report) return;
    const content = serializeMissingCoverageTerms({ folderTitle, report });
    downloadJson(content, `app-piteco-pendencias-${slugify(folderTitle)}.json`);
    toast.success("Pendências exportadas. Envie o JSON para uma IA preencher as traduções.");
  };

  const exportCovered = () => {
    if (!report) return;
    const content = serializeUsedCoverageEntries({ folderTitle, report, glossary: entries });
    downloadJson(content, `app-piteco-cobertas-${slugify(folderTitle)}.json`);
    toast.success("Entradas utilizadas nos cards foram exportadas.");
  };

  const importCompletedFile = async (file?: File) => {
    if (!file) return;
    if (!file.name.toLocaleLowerCase().endsWith(".json") && file.type !== "application/json") {
      toast.error("Selecione um arquivo .json.");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("O arquivo excede 25 MB.");
      return;
    }

    try {
      const parsed = parseFolderGlossaryJson(await file.text());
      if (parsed.length === 0) {
        toast.error("Nenhuma entrada preenchida foi encontrada. As traduções vazias não são importadas.");
        return;
      }
      await importEntries.mutateAsync({ entries: parsed, mode: "merge" });
      toast.success(`${parsed.length.toLocaleString("pt-BR")} entrada(s) importada(s). Reanalisando a cobertura...`);
      await runAudit();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível importar o arquivo preenchido.");
    }
  };

  if (!canEdit) return null;

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <ScanSearch className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <p className="font-medium">Auditar cobertura do glossário</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Compare todas as palavras dos cards com o glossário e exporte somente o que estiver faltando.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" className="shrink-0" onClick={() => handleOpenChange(true)}>
          <ScanSearch className="mr-2 h-4 w-4" />
          Verificar palavras
        </Button>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Auditoria de cobertura — {folderTitle}</DialogTitle>
            <DialogDescription>
              Correspondência exata por lado, incluindo palavras cobertas por expressões completas.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p>Lendo todas as listas, cards e palavras da pasta...</p>
              </div>
            ) : error ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <div>
                  <p className="font-semibold text-destructive">A auditoria não foi concluída</p>
                  <p className="mt-2 text-sm text-muted-foreground">{error}</p>
                </div>
                <Button variant="outline" onClick={() => void runAudit()}>
                  <RefreshCw className="mr-2 h-4 w-4" />Tentar novamente
                </Button>
              </div>
            ) : report ? (
              <>
                <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">Cobertura das ocorrências: {coveragePercent}%</p>
                      <p className="text-sm text-muted-foreground">
                        {report.listsScanned.toLocaleString("pt-BR")} listas · {report.cardsScanned.toLocaleString("pt-BR")} cards · {report.distinctTerms.toLocaleString("pt-BR")} termos distintos
                      </p>
                    </div>
                    {coveragePercent === 100 && (
                      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Cobertura completa
                      </Badge>
                    )}
                  </div>
                  <Progress value={coveragePercent} className="h-2" />
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={statusClasses.covered}>{report.coveredTerms} exatas</Badge>
                    <Badge variant="outline" className={statusClasses.expression}>{report.expressionTerms} por expressão</Badge>
                    <Badge variant="outline" className={statusClasses.missing}>{report.missingTerms} ausentes</Badge>
                    <Badge variant="outline" className={statusClasses.wrong_side}>{report.wrongSideTerms} no lado oposto</Badge>
                    <Badge variant="outline" className={statusClasses.inactive}>{report.inactiveTerms} inativas</Badge>
                  </div>
                </section>

                <section className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
                  <Input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar palavra ou frase de exemplo..."
                  />
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | FolderGlossaryCoverageStatus)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os resultados</SelectItem>
                      <SelectItem value="missing">Ausentes</SelectItem>
                      <SelectItem value="wrong_side">No lado oposto</SelectItem>
                      <SelectItem value="inactive">Inativas</SelectItem>
                      <SelectItem value="expression">Cobertas por expressão</SelectItem>
                      <SelectItem value="covered">No glossário</SelectItem>
                    </SelectContent>
                  </Select>
                </section>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={exportPending}
                    disabled={report.missingTerms + report.wrongSideTerms + report.inactiveTerms === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Exportar pendências JSON
                  </Button>
                  <Button type="button" variant="outline" onClick={exportCovered} disabled={report.usedGlossaryEntryIds.length === 0}>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar cobertas JSON
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      void importCompletedFile(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={importEntries.isPending}
                  >
                    {importEntries.isPending
                      ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      : <FileUp className="mr-2 h-4 w-4" />}
                    Importar pendências preenchidas
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => void runAudit()}>
                    <RefreshCw className="mr-2 h-4 w-4" />Reanalisar
                  </Button>
                </div>

                <section className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{filteredTerms.length.toLocaleString("pt-BR")} resultado(s)</span>
                    {filteredTerms.length > 300 && <span>Mostrando os 300 mais frequentes</span>}
                  </div>
                  {filteredTerms.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                      Nenhum termo encontrado neste filtro.
                    </div>
                  ) : (
                    <div className="divide-y rounded-xl border">
                      {filteredTerms.slice(0, 300).map((term) => (
                        <article key={`${term.side}-${term.normalized}`} className="space-y-2 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <strong className="break-words">{term.term}</strong>
                                <Badge variant="outline" className="text-[10px]">
                                  {term.side === "A" ? labelA : labelB}
                                </Badge>
                                <Badge variant="outline" className={statusClasses[term.status]}>
                                  {statusLabels[term.status]}
                                </Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {term.occurrenceCount.toLocaleString("pt-BR")} ocorrência(s) · {term.cardCount.toLocaleString("pt-BR")} card(s) · {term.listCount.toLocaleString("pt-BR")} lista(s)
                              </p>
                            </div>
                            {term.matchedGlossaryTerms.length > 0 && (
                              <span className="max-w-full text-xs text-muted-foreground">
                                Correspondência: {term.matchedGlossaryTerms.join(", ")}
                              </span>
                            )}
                          </div>
                          {term.examples[0] && (
                            <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs">
                              <p className="font-medium">{term.examples[0].listTitle}</p>
                              <p className="mt-1 break-words text-muted-foreground">{term.examples[0].text}</p>
                            </div>
                          )}
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
