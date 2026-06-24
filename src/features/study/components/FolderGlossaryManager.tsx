import { useMemo, useState } from "react";
import { Download, FileUp, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useFolderGlossary } from "@/hooks/useFolderGlossary";
import {
  parseFolderGlossaryJson,
  serializeFolderGlossary,
} from "@/features/study/lib/folderGlossaryTransfer";
import type {
  FolderGlossaryEntry,
  FolderGlossaryInput,
  GlossarySide,
} from "@/features/study/lib/folderGlossaryTypes";

interface Props {
  folderId: string;
  folderTitle: string;
  labelA: string;
  labelB: string;
}

interface Draft {
  id?: string;
  term: string;
  translation: string;
  alternatives: string;
  note: string;
  side: GlossarySide;
  active: boolean;
}

const blankDraft = (): Draft => ({
  term: "",
  translation: "",
  alternatives: "",
  note: "",
  side: "A",
  active: true,
});

export function FolderGlossaryManager({
  folderId,
  folderTitle,
  labelA,
  labelB,
}: Props) {
  const {
    entries,
    canEdit,
    isLoading,
    addEntry,
    updateEntry,
    deleteEntry,
    importEntries,
  } = useFolderGlossary(folderId);
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState<"all" | GlossarySide>("all");
  const [draft, setDraft] = useState<Draft>(blankDraft());
  const [editorOpen, setEditorOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importMode, setImportMode] = useState<"merge" | "replace">("merge");

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (sideFilter !== "all" && entry.side !== sideFilter) return false;
      if (!query) return true;
      return [
        entry.original_text,
        entry.primary_translation,
        ...entry.alternative_translations,
        entry.note ?? "",
      ].some((value) => value.toLocaleLowerCase().includes(query));
    });
  }, [entries, search, sideFilter]);

  const openEditor = (entry?: FolderGlossaryEntry) => {
    setDraft(entry ? {
      id: entry.id,
      term: entry.original_text,
      translation: entry.primary_translation,
      alternatives: entry.alternative_translations.join(", "),
      note: entry.note ?? "",
      side: entry.side,
      active: entry.is_active,
    } : blankDraft());
    setEditorOpen(true);
  };

  const saveDraft = async () => {
    const input: FolderGlossaryInput = {
      term: draft.term.trim(),
      translation: draft.translation.trim(),
      alternatives: draft.alternatives
        .split(/[,;]\s*/u)
        .map((item) => item.trim())
        .filter(Boolean),
      note: draft.note.trim() || null,
      side: draft.side,
      active: draft.active,
    };
    if (!input.term || !input.translation) return;

    if (draft.id) {
      await updateEntry.mutateAsync({
        id: draft.id,
        original_text: input.term,
        primary_translation: input.translation,
        alternative_translations: input.alternatives,
        note: input.note,
        side: input.side,
        is_active: input.active,
      });
    } else {
      await addEntry.mutateAsync(input);
    }
    setEditorOpen(false);
  };

  const runImport = async () => {
    try {
      const parsed = parseFolderGlossaryJson(importText);
      if (parsed.length === 0) {
        toast.error("Nenhuma entrada válida foi encontrada.");
        return;
      }
      await importEntries.mutateAsync({ entries: parsed, mode: importMode });
      setImportText("");
      setImportOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "JSON inválido.");
    }
  };

  const download = () => {
    const blob = new Blob(
      [serializeFolderGlossary({ id: folderId, title: folderTitle }, entries)],
      { type: "application/json;charset=utf-8" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `app-piteco-glossario-${folderTitle
      .replace(/[^a-z0-9]+/gi, "-")
      .toLowerCase()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-[minmax(0,1fr)_180px_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar termo, tradução ou nota..."
              className="pl-9"
            />
          </div>

          <Select value={sideFilter} onValueChange={(value) => setSideFilter(value as "all" | GlossarySide)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os lados</SelectItem>
              <SelectItem value="A">{labelA}</SelectItem>
              <SelectItem value="B">{labelB}</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button variant="outline" onClick={() => setImportOpen(true)}>
                <FileUp className="mr-2 h-4 w-4" />Importar
              </Button>
            )}
            <Button variant="outline" onClick={download} disabled={entries.length === 0}>
              <Download className="mr-2 h-4 w-4" />Exportar
            </Button>
            {canEdit && (
              <Button onClick={() => openEditor()}>
                <Plus className="mr-2 h-4 w-4" />Adicionar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filtered.length.toLocaleString("pt-BR")} termo(s)</span>
        {!canEdit && <Badge variant="outline">Somente leitura</Badge>}
      </div>

      {isLoading ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Carregando glossário...</Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed p-10 text-center">
          <CardTitle className="text-lg">Nenhum termo nesta pasta</CardTitle>
          <p className="mt-2 text-sm text-muted-foreground">
            {canEdit
              ? "Importe um JSON ou adicione a primeira entrada."
              : "O professor ainda não adicionou um glossário."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((entry) => (
            <Card key={entry.id} className={entry.is_active ? "" : "opacity-60"}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle className="break-words text-base">{entry.original_text}</CardTitle>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge variant="outline" className="text-[10px]">
                        {entry.side === "A" ? labelA : labelB}
                      </Badge>
                      {/\s/u.test(entry.original_text) && (
                        <Badge variant="secondary" className="text-[10px]">Expressão</Badge>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(entry)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (window.confirm(`Excluir “${entry.original_text}”?`)) {
                            deleteEntry.mutate(entry.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <p className="font-semibold text-primary">{entry.primary_translation}</p>
                {entry.alternative_translations.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {entry.alternative_translations.map((alternative) => (
                      <Badge key={alternative} variant="secondary">{alternative}</Badge>
                    ))}
                  </div>
                )}
                {entry.note && (
                  <p className="text-sm leading-relaxed text-muted-foreground">{entry.note}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{draft.id ? "Editar entrada" : "Adicionar entrada"}</DialogTitle>
            <DialogDescription>
              Uma entrada por termo, com tradução principal e alternativas agrupadas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Termo</Label>
                <Input value={draft.term} onChange={(event) => setDraft((value) => ({ ...value, term: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Tradução principal</Label>
                <Input value={draft.translation} onChange={(event) => setDraft((value) => ({ ...value, translation: event.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Alternativas, separadas por vírgula</Label>
              <Input value={draft.alternatives} onChange={(event) => setDraft((value) => ({ ...value, alternatives: event.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Nota de uso</Label>
              <Textarea value={draft.note} onChange={(event) => setDraft((value) => ({ ...value, note: event.target.value }))} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <Button type="button" size="sm" variant={draft.side === "A" ? "default" : "outline"} onClick={() => setDraft((value) => ({ ...value, side: "A" }))}>{labelA}</Button>
                <Button type="button" size="sm" variant={draft.side === "B" ? "default" : "outline"} onClick={() => setDraft((value) => ({ ...value, side: "B" }))}>{labelB}</Button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={draft.active} onCheckedChange={(checked) => setDraft((value) => ({ ...value, active: checked }))} />
                Ativo
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => void saveDraft()}
              disabled={!draft.term.trim() || !draft.translation.trim() || addEntry.isPending || updateEntry.isPending}
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Importar glossário para esta pasta</DialogTitle>
            <DialogDescription>
              O conteúdo ficará disponível para todas as listas de “{folderTitle}”.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select value={importMode} onValueChange={(value) => setImportMode(value as "merge" | "replace")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="merge">Mesclar com o glossário atual</SelectItem>
                <SelectItem value="replace">Substituir o glossário atual</SelectItem>
              </SelectContent>
            </Select>
            {importMode === "replace" && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                Substituir removerá as entradas atuais desta pasta antes de importar.
              </p>
            )}
            <Textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              className="min-h-[300px] font-mono text-xs"
              placeholder='{"entries":[{"term":"could","translation":"poderia","alternatives":["conseguia"],"side":"A"}]}'
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button>
            <Button onClick={() => void runImport()} disabled={!importText.trim() || importEntries.isPending}>
              Importar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
