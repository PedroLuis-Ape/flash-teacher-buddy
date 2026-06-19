import { useCallback, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BookOpen,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileJson,
  Import as ImportIcon,
  Layers3,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useListGlossary, type GlossaryEntry } from "@/hooks/useListGlossary";
import {
  isGlossaryOverlap,
  parseGlossaryTransfer,
  serializeGlossaryTransfer,
  type GlossaryExportFormat,
} from "@/features/study/lib/glossaryTransfer";

interface ListGlossaryManagerProps {
  listId: string;
  labelA?: string;
  labelB?: string;
  canEdit?: boolean;
}

const exampleImport = `=== GLOSSÁRIO GLOBAL ===
because / porque
of / de, da, do, das
because of / por causa de
=== CARDS ===`;

export const ListGlossaryManager = ({
  listId,
  labelA = "Lado A",
  labelB = "Lado B",
  canEdit = true,
}: ListGlossaryManagerProps) => {
  const {
    glossary,
    isLoading,
    error,
    addEntry,
    updateEntry,
    deleteEntry,
    toggleActive,
    bulkDelete,
    bulkSwapTerms,
    importEntries,
  } = useListGlossary(listId);

  const [isExpanded, setIsExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const [originalText, setOriginalText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [note, setNote] = useState("");
  const [side, setSide] = useState<"A" | "B">("A");

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importDefaultSide, setImportDefaultSide] = useState<"A" | "B">("A");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<GlossaryExportFormat>("text");

  const filteredGlossary = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return glossary;
    return glossary.filter((entry) =>
      [entry.original_text, entry.translated_text, entry.note]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(query)),
    );
  }, [glossary, search]);

  const relatedLayers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of glossary) {
      let count = 0;
      for (const candidate of glossary) {
        if (entry.id === candidate.id) continue;
        if (isGlossaryOverlap(entry, candidate)) count += 1;
      }
      counts.set(entry.id, count);
    }
    return counts;
  }, [glossary]);

  const overlapEntryCount = useMemo(
    () => Array.from(relatedLayers.values()).filter((count) => count > 0).length,
    [relatedLayers],
  );

  const importPreview = useMemo(
    () => parseGlossaryTransfer(importText, importDefaultSide),
    [importText, importDefaultSide],
  );

  const exportText = useMemo(
    () => serializeGlossaryTransfer(glossary, exportFormat),
    [glossary, exportFormat],
  );

  const resetForm = () => {
    setOriginalText("");
    setTranslatedText("");
    setNote("");
    setSide("A");
    setIsAdding(false);
    setEditingId(null);
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    const visibleIds = filteredGlossary.map((entry) => entry.id);
    const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
    setSelectedIds((previous) => {
      const next = new Set(previous);
      visibleIds.forEach((id) => allVisibleSelected ? next.delete(id) : next.add(id));
      return next;
    });
  };

  const handleAdd = () => {
    if (!originalText.trim() || !translatedText.trim()) return;
    addEntry.mutate({
      list_id: listId,
      original_text: originalText.trim(),
      translated_text: translatedText.trim(),
      note: note.trim() || undefined,
      side,
    }, { onSuccess: resetForm });
  };

  const handleEdit = (entry: GlossaryEntry) => {
    setEditingId(entry.id);
    setOriginalText(entry.original_text);
    setTranslatedText(entry.translated_text);
    setNote(entry.note || "");
    setSide(entry.side);
    setIsAdding(false);
  };

  const handleSaveEdit = () => {
    if (!editingId || !originalText.trim() || !translatedText.trim()) return;
    updateEntry.mutate({
      id: editingId,
      original_text: originalText.trim(),
      translated_text: translatedText.trim(),
      note: note.trim() || null,
      side,
    }, { onSuccess: resetForm });
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Apagar ${ids.length} camada(s) do glossário?`)) return;
    bulkDelete.mutate(ids, { onSuccess: exitSelectMode });
  };

  const handleSwap = (ids: string[]) => {
    if (ids.length === 0) return;
    if (!window.confirm(`Inverter ${ids.length} entrada(s), incluindo o lado de origem?`)) return;
    bulkSwapTerms.mutate(ids, { onSuccess: exitSelectMode });
  };

  const handleImport = async () => {
    if (importPreview.entries.length === 0) return;
    await importEntries.mutateAsync(importPreview.entries);
    setImportOpen(false);
    setImportText("");
  };

  const handleCopyExport = async () => {
    await navigator.clipboard.writeText(exportText);
    toast.success("Glossário copiado.");
  };

  const handleDownloadExport = () => {
    const extension = exportFormat === "json" ? "json" : "txt";
    const mime = exportFormat === "json" ? "application/json" : "text/plain";
    const blob = new Blob([exportText], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `app-piteco-glossario-${listId}.${extension}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!canEdit && glossary.length === 0) return null;

  return (
    <>
      <Card className="p-4">
        <button
          type="button"
          onClick={() => setIsExpanded((value) => !value)}
          className="flex w-full items-center gap-2 text-left text-sm font-medium transition-colors hover:text-foreground"
        >
          <BookOpen className="h-4 w-4 shrink-0 text-primary" />
          <span>Glossário Global da Lista</span>
          <span className="text-xs text-muted-foreground">({glossary.length})</span>
          {overlapEntryCount > 0 && (
            <Badge variant="secondary" className="hidden gap-1 text-[10px] sm:inline-flex">
              <Layers3 className="h-3 w-3" />
              {overlapEntryCount} em camadas
            </Badge>
          )}
          {isExpanded
            ? <ChevronUp className="ml-auto h-4 w-4 text-muted-foreground" />
            : <ChevronDown className="ml-auto h-4 w-4 text-muted-foreground" />}
        </button>

        {isExpanded && (
          <div className="mt-4 space-y-4">
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-muted-foreground">
              Cada palavra ou expressão é uma camada independente. Adicionar <strong className="text-foreground">because of</strong> não remove as entradas <strong className="text-foreground">because</strong> e <strong className="text-foreground">of</strong>; todas aparecem juntas na janelinha contextual.
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                Não foi possível carregar o glossário.
              </p>
            )}

            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative min-w-0 flex-1 lg:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar termo, tradução ou nota..."
                  className="h-9 pl-9"
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {canEdit && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => { resetForm(); setIsAdding(true); }}>
                      <Plus className="mr-1.5 h-4 w-4" />Adicionar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                      <ImportIcon className="mr-1.5 h-4 w-4" />Importar
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" onClick={() => setExportOpen(true)} disabled={glossary.length === 0}>
                  <Download className="mr-1.5 h-4 w-4" />Exportar
                </Button>
                {canEdit && glossary.length > 0 && (
                  <Button size="sm" variant={selectMode ? "secondary" : "outline"} onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}>
                    <CheckSquare className="mr-1.5 h-4 w-4" />{selectMode ? "Cancelar seleção" : "Selecionar"}
                  </Button>
                )}
              </div>
            </div>

            {selectMode && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2">
                <Button size="sm" variant="ghost" onClick={toggleSelectAll}>Selecionar visíveis</Button>
                <Button size="sm" variant="outline" disabled={selectedIds.size === 0 || bulkSwapTerms.isPending} onClick={() => handleSwap(Array.from(selectedIds))}>
                  <ArrowLeftRight className="mr-1.5 h-4 w-4" />Inverter ({selectedIds.size})
                </Button>
                <Button size="sm" variant="destructive" disabled={selectedIds.size === 0 || bulkDelete.isPending} onClick={handleBulkDelete}>
                  <Trash2 className="mr-1.5 h-4 w-4" />Apagar ({selectedIds.size})
                </Button>
              </div>
            )}

            {canEdit && isAdding && (
              <EntryForm
                originalText={originalText}
                setOriginalText={setOriginalText}
                translatedText={translatedText}
                setTranslatedText={setTranslatedText}
                note={note}
                setNote={setNote}
                side={side}
                setSide={setSide}
                labelA={labelA}
                labelB={labelB}
                onSave={handleAdd}
                onCancel={resetForm}
                saving={addEntry.isPending}
              />
            )}

            {isLoading ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Carregando glossário...</p>
            ) : filteredGlossary.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                {glossary.length === 0 ? "Nenhuma entrada no glossário." : "Nenhuma entrada encontrada."}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredGlossary.map((entry) => {
                  if (editingId === entry.id) {
                    return (
                      <EntryForm
                        key={entry.id}
                        originalText={originalText}
                        setOriginalText={setOriginalText}
                        translatedText={translatedText}
                        setTranslatedText={setTranslatedText}
                        note={note}
                        setNote={setNote}
                        side={side}
                        setSide={setSide}
                        labelA={labelA}
                        labelB={labelB}
                        onSave={handleSaveEdit}
                        onCancel={resetForm}
                        saving={updateEntry.isPending}
                      />
                    );
                  }

                  const relatedCount = relatedLayers.get(entry.id) ?? 0;
                  return (
                    <div
                      key={entry.id}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border p-3 text-sm transition-colors",
                        !entry.is_active && "opacity-55",
                        selectedIds.has(entry.id) && "border-primary bg-primary/5",
                      )}
                    >
                      {selectMode && (
                        <Checkbox
                          checked={selectedIds.has(entry.id)}
                          onCheckedChange={() => toggleSelect(entry.id)}
                          className="mt-1 shrink-0"
                        />
                      )}

                      <div className="min-w-0 flex-1" onClick={selectMode ? () => toggleSelect(entry.id) : undefined}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="break-words font-semibold">{entry.original_text}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="break-words font-medium text-primary">{entry.translated_text}</span>
                        </div>
                        {entry.note && <p className="mt-1 text-xs italic leading-relaxed text-muted-foreground">{entry.note}</p>}
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="outline" className="text-[10px]">Origem: {entry.side === "A" ? labelA : labelB}</Badge>
                          {/\s/u.test(entry.original_text.trim()) && <Badge variant="secondary" className="text-[10px]">Expressão</Badge>}
                          {relatedCount > 0 && (
                            <Badge variant="secondary" className="gap-1 text-[10px]">
                              <Layers3 className="h-3 w-3" />{relatedCount + 1} camadas relacionadas
                            </Badge>
                          )}
                          {!entry.is_active && <Badge variant="outline" className="text-[10px]">Inativa</Badge>}
                        </div>
                      </div>

                      {canEdit && !selectMode && (
                        <div className="flex shrink-0 items-center gap-1">
                          <Switch
                            checked={entry.is_active}
                            onCheckedChange={(checked) => toggleActive.mutate({ id: entry.id, is_active: checked })}
                            className="scale-75"
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(entry)} aria-label="Editar entrada">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (window.confirm(`Excluir “${entry.original_text}”?`)) deleteEntry.mutate(entry.id);
                            }}
                            aria-label="Excluir entrada"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {canEdit && glossary.length > 0 && !selectMode && (
              <Button variant="ghost" size="sm" disabled={bulkSwapTerms.isPending} onClick={() => handleSwap(glossary.map((entry) => entry.id))}>
                <ArrowLeftRight className="mr-1.5 h-4 w-4" />Inverter todos os termos e lados
              </Button>
            )}
          </div>
        )}
      </Card>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ImportIcon className="h-5 w-5" />Importar glossário</DialogTitle>
            <DialogDescription>
              A importação é cumulativa. Palavras e expressões maiores coexistem; uma nova expressão nunca apaga as camadas existentes.
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[65vh] pr-3">
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label>Lado padrão para linhas simples</Label>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={importDefaultSide === "A" ? "default" : "outline"} onClick={() => setImportDefaultSide("A")}>{labelA}</Button>
                  <Button type="button" size="sm" variant={importDefaultSide === "B" ? "default" : "outline"} onClick={() => setImportDefaultSide("B")}>{labelB}</Button>
                </div>
              </div>

              <Textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder={exampleImport}
                className="min-h-[280px] font-mono text-sm"
              />

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setImportText(exampleImport)}>
                  Usar exemplo
                </Button>
                <Badge variant="secondary">{importPreview.entries.length} entrada(s) válida(s)</Badge>
                <Badge variant="outline">Formato: {importPreview.format}</Badge>
              </div>

              {importPreview.errors.length > 0 && (
                <div className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                  {importPreview.errors.slice(0, 8).map((message) => <p key={message}>{message}</p>)}
                  {importPreview.errors.length > 8 && <p>Mais {importPreview.errors.length - 8} erro(s).</p>}
                </div>
              )}

              <p className="text-xs leading-relaxed text-muted-foreground">
                O texto simples é compatível com <strong>=== GLOSSÁRIO GLOBAL ===</strong>. Para restauração completa de lado, notas e entradas inativas, importe o backup JSON gerado pelo próprio aplicativo.
              </p>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={handleImport} disabled={importEntries.isPending || importPreview.entries.length === 0}>
              {importEntries.isPending ? "Importando..." : `Importar ${importPreview.entries.length} entrada(s)`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Download className="h-5 w-5" />Exportar glossário</DialogTitle>
            <DialogDescription>
              Use texto para copiar ao Super Importador ou JSON para um backup completo e sem perdas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Button type="button" variant={exportFormat === "text" ? "default" : "outline"} onClick={() => setExportFormat("text")}>
                <BookOpen className="mr-2 h-4 w-4" />Texto compatível
              </Button>
              <Button type="button" variant={exportFormat === "json" ? "default" : "outline"} onClick={() => setExportFormat("json")}>
                <FileJson className="mr-2 h-4 w-4" />Backup JSON completo
              </Button>
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              {exportFormat === "text"
                ? "Exporta as entradas ativas no formato do Super Importador. Entradas do Lado B são normalizadas para a direção A → B."
                : "Preserva exatamente lado de origem, observações, estado ativo/inativo e todas as entradas sobrepostas."}
            </p>

            <Textarea value={exportText} readOnly className="min-h-[320px] font-mono text-xs sm:text-sm" />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={handleCopyExport}><Copy className="mr-2 h-4 w-4" />Copiar</Button>
            <Button onClick={handleDownloadExport}><Download className="mr-2 h-4 w-4" />Baixar arquivo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

function EntryForm({
  originalText,
  setOriginalText,
  translatedText,
  setTranslatedText,
  note,
  setNote,
  side,
  setSide,
  labelA,
  labelB,
  onSave,
  onCancel,
  saving,
}: {
  originalText: string;
  setOriginalText: (value: string) => void;
  translatedText: string;
  setTranslatedText: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  side: "A" | "B";
  setSide: (value: "A" | "B") => void;
  labelA: string;
  labelB: string;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-3 rounded-lg border-2 border-primary/30 bg-primary/5 p-3 animate-in fade-in-0 slide-in-from-top-1">
      <div className="space-y-1.5">
        <Label className="text-xs">Lado de origem</Label>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={side === "A" ? "default" : "outline"} size="sm" onClick={() => setSide("A")}>{labelA}</Button>
          <Button type="button" variant={side === "B" ? "default" : "outline"} size="sm" onClick={() => setSide("B")}>{labelB}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Palavra ou expressão original</Label>
          <Input value={originalText} onChange={(event) => setOriginalText(event.target.value)} placeholder="Ex.: because of" autoFocus />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Tradução</Label>
          <Input value={translatedText} onChange={(event) => setTranslatedText(event.target.value)} placeholder="Ex.: por causa de" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Observação opcional</Label>
        <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Uso, contexto ou dica gramatical..." />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onSave} disabled={saving || !originalText.trim() || !translatedText.trim()}>
          {saving ? "Salvando..." : "Salvar camada"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
      </div>
    </div>
  );
}
