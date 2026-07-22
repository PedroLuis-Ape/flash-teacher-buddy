import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Download, FileUp, Loader2, RefreshCw, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFolderGlossary } from "@/hooks/useFolderGlossary";
import { loadFolderGlossary } from "@/features/study/lib/folderGlossaryApi";
import type { FolderGlossaryEntry } from "@/features/study/lib/folderGlossaryTypes";
import {
  serializeUsedCoverageEntries,
  type FolderGlossaryCoverageReport,
  type FolderGlossaryCoverageStatus,
} from "@/features/study/lib/folderGlossaryCoverage";
import { getFolderGlossaryCoveragePresentation } from "@/features/study/lib/folderGlossaryCoveragePresentation";
import {
  getExactCoveragePendingTerms,
  parseExactCoverageCompletionJson,
  serializeExactCoverageRequest,
} from "@/features/study/lib/folderGlossaryExactCoverage";
import { loadClassGlossaryCoverage } from "@/features/classroom/lib/classGlossary";

interface Props {
  turmaId: string;
  turmaTitle: string;
  storageFolderId: string;
  labelA: string;
  labelB: string;
}

const statusLabels: Record<FolderGlossaryCoverageStatus, string> = {
  covered: "Exata",
  expression: "Somente por expressão",
  inactive: "Inativa",
  wrong_side: "Lado oposto",
  missing: "Ausente",
};

function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "turma";
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

export function ClassGlossaryCoverageCard({
  turmaId,
  turmaTitle,
  storageFolderId,
  labelA,
  labelB,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { canEdit, importEntries } = useFolderGlossary(storageFolderId);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<FolderGlossaryCoverageReport | null>(null);
  const [auditGlossary, setAuditGlossary] = useState<FolderGlossaryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | FolderGlossaryCoverageStatus>("missing");

  const runAudit = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const latest = await loadFolderGlossary(storageFolderId);
      const next = await loadClassGlossaryCoverage({
        turmaId,
        storageFolderId,
        glossary: latest.entries,
      });
      setAuditGlossary(latest.entries);
      setReport(next);
      if (next.missingTerms > 0) setStatusFilter("missing");
      else if (next.wrongSideTerms > 0) setStatusFilter("wrong_side");
      else if (next.inactiveTerms > 0) setStatusFilter("inactive");
      else if (next.expressionTerms > 0) setStatusFilter("expression");
      else setStatusFilter("all");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível auditar o glossário da turma.");
    } finally {
      setLoading(false);
    }
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

  const pendingTerms = useMemo(
    () => report ? getExactCoveragePendingTerms(report) : [],
    [report],
  );
  const coverage = getFolderGlossaryCoveragePresentation(
    report?.coveredTerms ?? 0,
    report?.distinctTerms ?? 0,
  );

  const exportPending = () => {
    if (!report) return;
    downloadJson(serializeExactCoverageRequest({
      folderTitle: `Turma: ${turmaTitle}`,
      labelA,
      labelB,
      report,
    }), `app-piteco-palavras-pendentes-turma-${slugify(turmaTitle)}.json`);
    toast.success(`${pendingTerms.length.toLocaleString("pt-BR")} palavra(s) pendente(s) exportada(s).`);
  };

  const exportCovered = () => {
    if (!report) return;
    const coveredKeys = new Set(
      report.terms
        .filter((term) => term.status === "covered" || term.status === "expression")
        .flatMap((term) => term.matchedGlossaryTerms.map((match) => `${term.side}|${normalize(match)}`)),
    );
    const coveredGlossary = auditGlossary.filter((entry) =>
      entry.is_active && coveredKeys.has(`${entry.side}|${normalize(entry.original_text)}`));
    downloadJson(serializeUsedCoverageEntries({
      folderTitle: `Turma: ${turmaTitle}`,
      report,
      glossary: coveredGlossary,
    }), `app-piteco-glossario-coberto-turma-${slugify(turmaTitle)}.json`);
    toast.success("Backup das entradas usadas pelos materiais da turma exportado.");
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
    if (!report) {
      toast.error("Execute a auditoria antes de importar.");
      return;
    }

    try {
      const parsed = parseExactCoverageCompletionJson(await file.text(), report);
      await importEntries.mutateAsync({ entries: parsed, mode: "merge" });
      toast.success(`${parsed.length.toLocaleString("pt-BR")} palavra(s) importada(s). Reanalisando a turma...`);
      await runAudit();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível importar o arquivo preenchido.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!canEdit) return null;

  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <ScanSearch className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="min-w-0">
            <p className="font-medium">Auditar cobertura exata da turma</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Lê todas as listas atribuídas à turma e verifica cada palavra dos dois lados sem usar glossários de pastas pessoais.
            </p>
          </div>
        </div>
        <Button type="button" variant="outline" className="shrink-0" onClick={() => {
          setOpen(true);
          if (!report) void runAudit();
        }}>
          <ScanSearch className="mr-2 h-4 w-4" />Verificar palavras
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[92vh] w-[calc(100vw-2rem)] max-w-5xl flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Auditoria exata — {turmaTitle}</DialogTitle>
            <DialogDescription>
              Somente entradas desta turma contam. Uma palavra precisa de uma entrada individual ativa no lado correto.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            {loading ? (
              <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p>Lendo materiais e palavras da turma...</p>
              </div>
            ) : error ? (
              <div className="flex min-h-52 flex-col items-center justify-center gap-4 rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" onClick={() => void runAudit()}>
                  <RefreshCw className="mr-2 h-4 w-4" />Tentar novamente
                </Button>
              </div>
            ) : report ? (
              <>
                <section className="space-y-3 rounded-xl border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">Cobertura exata: {coverage.label}%</p>
                      <p className="text-sm text-muted-foreground">
                        {report.coveredTerms.toLocaleString("pt-BR")} de {report.distinctTerms.toLocaleString("pt-BR")} palavras · {report.listsScanned.toLocaleString("pt-BR")} listas · {report.cardsScanned.toLocaleString("pt-BR")} cards
                      </p>
                    </div>
                    {coverage.complete && (
                      <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Completa
                      </Badge>
                    )}
                  </div>
                  <Progress value={coverage.percent} className="h-2" />
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{report.coveredTerms} exatas</Badge>
                    <Badge variant="outline">{report.expressionTerms} por expressão</Badge>
                    <Badge variant="outline">{report.missingTerms} ausentes</Badge>
                    <Badge variant="outline">{report.wrongSideTerms} lado oposto</Badge>
                    <Badge variant="outline">{report.inactiveTerms} inativas</Badge>
                  </div>
                </section>

                <section className="grid gap-3 lg:grid-cols-3">
                  <Button type="button" onClick={exportPending} disabled={pendingTerms.length === 0}>
                    <Download className="mr-2 h-4 w-4" />Exportar faltantes ({pendingTerms.length})
                  </Button>
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                    <FileUp className="mr-2 h-4 w-4" />Importar preenchidas
                  </Button>
                  <Button type="button" variant="outline" onClick={exportCovered} disabled={report.coveredTerms === 0}>
                    <Download className="mr-2 h-4 w-4" />Backup das cobertas
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={(event) => void importCompletedFile(event.target.files?.[0])}
                  />
                </section>

                <section className="space-y-3 rounded-xl border p-4">
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_210px]">
                    <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar palavra ou exemplo..." />
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as "all" | FolderGlossaryCoverageStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os estados</SelectItem>
                        {Object.entries(statusLabels).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="max-h-80 space-y-2 overflow-y-auto">
                    {filteredTerms.slice(0, 300).map((term) => (
                      <div key={`${term.side}-${term.normalized}`} className="rounded-lg border bg-muted/20 p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium">{term.term}</p>
                          <Badge variant="outline">{term.side} · {statusLabels[term.status]}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {term.occurrenceCount.toLocaleString("pt-BR")} ocorrência(s) em {term.listCount.toLocaleString("pt-BR")} lista(s)
                        </p>
                        {term.examples[0] && (
                          <p className="mt-2 text-sm leading-relaxed">{term.examples[0].text}</p>
                        )}
                      </div>
                    ))}
                    {filteredTerms.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">Nenhum resultado.</p>}
                  </div>
                </section>
              </>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            <Button onClick={() => void runAudit()} disabled={loading}>
              <RefreshCw className="mr-2 h-4 w-4" />Reanalisar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
