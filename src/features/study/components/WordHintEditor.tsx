/**
 * WordHintEditor — Manual text-selection UI for binding word/expression hints.
 *
 * The user selects a range in the source phrase → enters translation + note →
 * the hint is saved with exact startIndex/endIndex positions.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Languages, Trash2, Pencil, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WordHint } from "@/features/study/lib/wordHints";
import { validateHintIndices, revalidateHints } from "@/features/study/lib/wordHints";

interface WordHintEditorProps {
  value: WordHint[];
  onChange: (hints: WordHint[]) => void;
  /** The source text (term / Side A) to select from */
  sourceText: string;
}

interface PendingSelection {
  text: string;
  startIndex: number;
  endIndex: number;
}

export const WordHintEditor = ({ value, onChange, sourceText }: WordHintEditorProps) => {
  const [isExpanded, setIsExpanded] = useState(value.length > 0);
  const [pending, setPending] = useState<PendingSelection | null>(null);
  const [pendingTranslation, setPendingTranslation] = useState("");
  const [pendingNote, setPendingNote] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [hasStaleHints, setHasStaleHints] = useState(false);
  const phraseRef = useRef<HTMLDivElement>(null);
  const translationInputRef = useRef<HTMLInputElement>(null);

  // Validate hints when sourceText changes
  useEffect(() => {
    if (value.length === 0) {
      setHasStaleHints(false);
      return;
    }
    const validations = validateHintIndices(sourceText, value);
    const anyStale = validations.some((v) => !v.valid && v.hint.startIndex !== undefined);
    setHasStaleHints(anyStale);
  }, [sourceText, value]);

  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !phraseRef.current) return;

    const range = selection.getRangeAt(0);
    if (!phraseRef.current.contains(range.commonAncestorContainer)) return;

    // Calculate offset relative to the phrase container's full text
    const fullText = phraseRef.current.textContent || "";
    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Walk the DOM to find the exact character offset
    const treeWalker = document.createTreeWalker(phraseRef.current, NodeFilter.SHOW_TEXT);
    let charOffset = 0;
    let startIndex = -1;

    while (treeWalker.nextNode()) {
      const node = treeWalker.currentNode as Text;
      if (node === range.startContainer) {
        startIndex = charOffset + range.startOffset;
      }
      if (startIndex !== -1) break;
      charOffset += node.textContent?.length || 0;
    }

    if (startIndex === -1) return;

    // Verify the text at these indices matches
    const endIndex = startIndex + selectedText.length;
    const verify = fullText.slice(startIndex, endIndex);
    if (verify !== selectedText) return;

    // Check for overlap with existing hints
    const overlaps = value.some(
      (h) =>
        h.startIndex !== undefined &&
        h.endIndex !== undefined &&
        startIndex < h.endIndex &&
        endIndex > h.startIndex
    );
    if (overlaps) return;

    setPending({ text: selectedText, startIndex, endIndex });
    setPendingTranslation("");
    setPendingNote("");
    selection.removeAllRanges();

    // Focus translation input after popover opens
    setTimeout(() => translationInputRef.current?.focus(), 100);
  }, [value, sourceText]);

  const savePending = useCallback(() => {
    if (!pending || !pendingTranslation.trim()) return;

    const newHint: WordHint = {
      text: pending.text,
      translation: pendingTranslation.trim(),
      note: pendingNote.trim() || undefined,
      startIndex: pending.startIndex,
      endIndex: pending.endIndex,
    };

    onChange([...value, newHint]);
    setPending(null);
    setPendingTranslation("");
    setPendingNote("");
  }, [pending, pendingTranslation, pendingNote, value, onChange]);

  const cancelPending = useCallback(() => {
    setPending(null);
    setPendingTranslation("");
    setPendingNote("");
  }, []);

  const removeItem = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange]
  );

  const startEditing = useCallback((index: number) => {
    setEditingIndex(index);
    setPendingTranslation(value[index].translation);
    setPendingNote(value[index].note || "");
  }, [value]);

  const saveEditing = useCallback(() => {
    if (editingIndex === null || !pendingTranslation.trim()) return;
    const updated = [...value];
    updated[editingIndex] = {
      ...updated[editingIndex],
      translation: pendingTranslation.trim(),
      note: pendingNote.trim() || undefined,
    };
    onChange(updated);
    setEditingIndex(null);
    setPendingTranslation("");
    setPendingNote("");
  }, [editingIndex, pendingTranslation, pendingNote, value, onChange]);

  const handleRevalidate = useCallback(() => {
    const updated = revalidateHints(sourceText, value);
    onChange(updated);
    setHasStaleHints(false);
  }, [sourceText, value, onChange]);

  // Render the phrase with highlights for bound hints
  const renderPhrase = () => {
    if (!sourceText) return <span className="text-muted-foreground italic">Digite a frase no campo acima primeiro</span>;

    // Build segments from existing hints
    const sortedHints = [...value]
      .filter((h) => h.startIndex !== undefined && h.endIndex !== undefined)
      .sort((a, b) => a.startIndex! - b.startIndex!);

    const segments: { text: string; hintIndex?: number }[] = [];
    let cursor = 0;

    for (const hint of sortedHints) {
      const start = hint.startIndex!;
      const end = Math.min(hint.endIndex!, sourceText.length);
      if (start < cursor) continue;

      if (start > cursor) {
        segments.push({ text: sourceText.slice(cursor, start) });
      }
      const idx = value.indexOf(hint);
      segments.push({ text: sourceText.slice(start, end), hintIndex: idx });
      cursor = end;
    }
    if (cursor < sourceText.length) {
      segments.push({ text: sourceText.slice(cursor) });
    }

    // If no index-based hints exist, just show the full text
    if (sortedHints.length === 0) {
      return <span>{sourceText}</span>;
    }

    return (
      <>
        {segments.map((seg, i) =>
          seg.hintIndex !== undefined ? (
            <span
              key={i}
              className="bg-amber-200/60 dark:bg-amber-500/30 border-b-2 border-amber-400 rounded-sm px-0.5 cursor-default"
              title={value[seg.hintIndex].translation}
            >
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </>
    );
  };

  if (!isExpanded && value.length === 0) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setIsExpanded(true)}
        className="text-muted-foreground gap-1.5"
      >
        <Languages className="h-4 w-4" />
        Adicionar tradução por palavra/expressão
      </Button>
    );
  }

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <Languages className="h-4 w-4" />
        Tradução por palavra/expressão ({value.length})
        {isExpanded ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
      </button>

      {isExpanded && (
        <div className="space-y-3">
          {/* Stale hints warning */}
          {hasStaleHints && (
            <div className="flex items-center gap-2 p-2 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>A frase foi alterada. Alguns vínculos podem estar desatualizados.</span>
              <Button type="button" variant="outline" size="sm" onClick={handleRevalidate} className="ml-auto text-xs h-7">
                Revalidar
              </Button>
            </div>
          )}

          {/* Selectable phrase area */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Selecione um trecho da frase abaixo para vincular uma tradução:
            </Label>
            <div
              ref={phraseRef}
              onMouseUp={handleTextSelection}
              onTouchEnd={handleTextSelection}
              className={cn(
                "p-3 rounded-md border bg-background text-base leading-relaxed select-text cursor-text",
                "min-h-[48px] break-words"
              )}
            >
              {renderPhrase()}
            </div>
          </div>

          {/* Pending selection popover */}
          {pending && (
            <div className="p-3 rounded-md border-2 border-primary/40 bg-primary/5 space-y-2 animate-in fade-in-0 slide-in-from-top-1">
              <p className="text-sm">
                Trecho selecionado:{" "}
                <span className="font-semibold text-primary">"{pending.text}"</span>
              </p>
              <div className="space-y-1">
                <Label className="text-xs">Tradução</Label>
                <Input
                  ref={translationInputRef}
                  value={pendingTranslation}
                  onChange={(e) => setPendingTranslation(e.target.value)}
                  placeholder="Digite a tradução..."
                  className="text-sm h-9"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      savePending();
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Observação (opcional)</Label>
                <Input
                  value={pendingNote}
                  onChange={(e) => setPendingNote(e.target.value)}
                  placeholder="Dica ou explicação..."
                  className="text-sm h-9"
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={savePending} disabled={!pendingTranslation.trim()}>
                  Salvar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={cancelPending}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Existing hints list */}
          {value.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Vínculos criados:</Label>
              {value.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 p-2 rounded-md bg-background border text-sm"
                >
                  {editingIndex === index ? (
                    <div className="flex-1 space-y-1.5">
                      <Input
                        value={pendingTranslation}
                        onChange={(e) => setPendingTranslation(e.target.value)}
                        placeholder="Tradução"
                        className="text-sm h-8"
                      />
                      <Input
                        value={pendingNote}
                        onChange={(e) => setPendingNote(e.target.value)}
                        placeholder="Observação (opcional)"
                        className="text-sm h-8"
                      />
                      <div className="flex gap-1.5">
                        <Button type="button" size="sm" className="h-7 text-xs" onClick={saveEditing}>
                          Salvar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => { setEditingIndex(null); setPendingTranslation(""); setPendingNote(""); }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 rounded text-xs">
                        {item.text}
                      </span>
                      <span className="text-muted-foreground">→</span>
                      <span className="flex-1 truncate">{item.translation}</span>
                      {item.note && <span className="text-xs text-muted-foreground italic truncate max-w-[100px]">({item.note})</span>}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => startEditing(index)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                        onClick={() => removeItem(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
