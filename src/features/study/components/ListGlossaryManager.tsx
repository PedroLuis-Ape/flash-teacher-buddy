/**
 * ListGlossaryManager — UI to manage per-list global glossary entries.
 * Supports add, edit, delete, toggle active.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Languages, Plus, Trash2, Pencil, ChevronDown, ChevronUp, BookOpen } from "lucide-react";
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
  const { glossary, addEntry, updateEntry, deleteEntry, toggleActive } = useListGlossary(listId);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
                      !entry.is_active && "opacity-50"
                    )}
                  >
                    <div className="flex-1 min-w-0">
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
                    {canEdit && (
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
          {canEdit && !isAdding && !editingId && (
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
