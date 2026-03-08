/**
 * ListGlossaryManager — UI to manage per-list global glossary entries.
 * Supports add, edit, delete, toggle active, and bulk delete.
 */

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Languages, Plus, Trash2, Pencil, ChevronDown, ChevronUp, BookOpen, CheckSquare, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useListGlossary, type GlossaryEntry } from "@/hooks/useListGlossary";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ListGlossaryManagerProps {
  listId: string;
  labelA?: string;
  labelB?: string;
  canEdit?: boolean;
}

export const ListGlossaryManager = ({
  listId,
  labelA = "Lado A",
  labelB = "Lado B",
  canEdit = true,
}: ListGlossaryManagerProps) => {
  const { glossary, addEntry, updateEntry, deleteEntry, toggleActive, bulkDelete, bulkSwapTerms } = useListGlossary(listId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Form state
  const [originalText, setOriginalText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [note, setNote] = useState("");
  const [side, setSide] = useState<"A" | "B">("A");

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
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = () => {
    if (selectedIds.size === glossary.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(glossary.map((g) => g.id)));
    }
  };

  const handleBulkDelete = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkDelete.mutate(ids, { onSuccess: exitSelectMode });
  };

  const handleSwapSelected = () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    bulkSwapTerms.mutate(ids, { onSuccess: exitSelectMode });
  };

  const handleSwapAll = () => {
    const ids = glossary.map((g) => g.id);
    if (ids.length === 0) return;
    bulkSwapTerms.mutate(ids);
  };

  const handleAdd = () => {
    if (!originalText.trim() || !translatedText.trim()) return;
    addEntry.mutate(
      {
        list_id: listId,
        original_text: originalText.trim(),
        translated_text: translatedText.trim(),
        note: note.trim() || undefined,
        side,
      },
      { onSuccess: resetForm }
    );
  };

  const handleEdit = (entry: GlossaryEntry) => {
    setEditingId(entry.id);
    setOriginalText(entry.original_text);
    setTranslatedText(entry.translated_text);
    setNote(entry.note || "");
    setSide(entry.side as "A" | "B");
  };

  const handleSaveEdit = () => {
    if (!editingId || !originalText.trim() || !translatedText.trim()) return;
    updateEntry.mutate(
      {
        id: editingId,
        original_text: originalText.trim(),
        translated_text: translatedText.trim(),
        note: note.trim() || null,
        side,
      },
      { onSuccess: resetForm }
    );
  };

  if (!canEdit && glossary.length === 0) return null;

  return (
    <Card className="p-4">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium w-full hover:text-foreground transition-colors"
      >
        <BookOpen className="h-4 w-4 text-primary" />
        <span>Glossário Global da Lista</span>
        <span className="text-muted-foreground text-xs">({glossary.length})</span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 ml-auto text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 ml-auto text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-muted-foreground">
            Traduções globais aparecem automaticamente em todos os cards desta lista quando a palavra/expressão corresponder.
          </p>

          {/* Select mode toolbar */}
          {canEdit && glossary.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {!selectMode ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectMode(true)}
                    className="gap-1.5 text-xs"
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                    Selecionar
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        disabled={bulkSwapTerms.isPending}
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                        Inverter todos
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Inverter todos os termos?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso vai trocar "original → tradução" por "tradução → original" em todas as {glossary.length} entradas do glossário. Os labels (A/B) permanecem iguais.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleSwapAll}>
                          {bulkSwapTerms.isPending ? "Invertendo..." : "Inverter todos"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              ) : (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAll}
                    className="text-xs"
                  >
                    {selectedIds.size === glossary.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedIds.size === 0 || bulkSwapTerms.isPending}
                    onClick={handleSwapSelected}
                    className="gap-1.5 text-xs"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                    Inverter ({selectedIds.size})
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={selectedIds.size === 0 || bulkDelete.isPending}
                        className="gap-1.5 text-xs"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Apagar ({selectedIds.size})
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Apagar {selectedIds.size} tradução(ões)?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Essa ação não pode ser desfeita. As traduções selecionadas serão removidas permanentemente do glossário.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleBulkDelete}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {bulkDelete.isPending ? "Apagando..." : "Apagar"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={exitSelectMode}
                    className="text-xs"
                  >
                    Cancelar
                  </Button>
                </>
              )}
            </div>
          )}

          {/* Existing entries */}
          {glossary.length > 0 && (
            <div className="space-y-2">
              {glossary.map((entry) =>
                editingId === entry.id ? (
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
                ) : (
                  <div
                    key={entry.id}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-md border text-sm",
                      !entry.is_active && "opacity-50",
                      selectMode && selectedIds.has(entry.id) && "border-primary bg-primary/5"
                    )}
                  >
                    {selectMode && (
                      <Checkbox
                        checked={selectedIds.has(entry.id)}
                        onCheckedChange={() => toggleSelect(entry.id)}
                        className="shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0" onClick={selectMode ? () => toggleSelect(entry.id) : undefined}>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium truncate">{entry.original_text}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-primary truncate">{entry.translated_text}</span>
                      </div>
                      {entry.note && (
                        <p className="text-xs text-muted-foreground italic mt-0.5 truncate">{entry.note}</p>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {entry.side === "A" ? labelA : labelB}
                      </span>
                    </div>
                    {canEdit && !selectMode && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Switch
                          checked={entry.is_active}
                          onCheckedChange={(checked) =>
                            toggleActive.mutate({ id: entry.id, is_active: checked })
                          }
                          className="scale-75"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleEdit(entry)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir tradução global?</AlertDialogTitle>
                              <AlertDialogDescription>
                                A tradução "{entry.original_text} → {entry.translated_text}" será removida do glossário.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteEntry.mutate(entry.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          )}

          {/* Add new entry */}
          {canEdit && !isAdding && !editingId && !selectMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar tradução global
            </Button>
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
        </div>
      )}
    </Card>
  );
};

// Internal form component for add/edit
function EntryForm({
  originalText, setOriginalText,
  translatedText, setTranslatedText,
  note, setNote,
  side, setSide,
  labelA, labelB,
  onSave, onCancel, saving,
}: {
  originalText: string; setOriginalText: (v: string) => void;
  translatedText: string; setTranslatedText: (v: string) => void;
  note: string; setNote: (v: string) => void;
  side: "A" | "B"; setSide: (v: "A" | "B") => void;
  labelA: string; labelB: string;
  onSave: () => void; onCancel: () => void; saving: boolean;
}) {
  return (
    <div className="p-3 rounded-md border-2 border-primary/30 bg-primary/5 space-y-2 animate-in fade-in-0 slide-in-from-top-1">
      <div className="space-y-1">
        <Label className="text-xs">Lado de origem</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={side === "A" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSide("A")}
          >
            {labelA}
          </Button>
          <Button
            type="button"
            variant={side === "B" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSide("B")}
          >
            {labelB}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Palavra/expressão original</Label>
          <Input
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            placeholder="Ex: travaille"
            className="text-sm h-9"
            autoFocus
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tradução</Label>
          <Input
            value={translatedText}
            onChange={(e) => setTranslatedText(e.target.value)}
            placeholder="Ex: trabalhar"
            className="text-sm h-9"
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Observação (opcional)</Label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Dica gramatical, conjugação..."
          className="text-sm h-9"
        />
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={onSave}
          disabled={saving || !originalText.trim() || !translatedText.trim()}
        >
          {saving ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}