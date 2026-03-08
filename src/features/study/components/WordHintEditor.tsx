/**
 * WordHintEditor — Manual text-selection UI for binding word/expression hints.
 *
 * Supports selecting from Side A or Side B, plus fully manual text entry.
 * No auto-fill or locked selections — the user has full control.
 * Supports suppressGlobal flag for overriding list-level glossary per card.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Languages, Trash2, Pencil, ChevronDown, ChevronUp, AlertTriangle, Type } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WordHint } from "@/features/study/lib/wordHints";
import { validateHintIndices, revalidateHints } from "@/features/study/lib/wordHints";

type SourceSide = "A" | "B";

interface WordHintEditorProps {
  value: WordHint[];
  onChange: (hints: WordHint[]) => void;
  /** Side A text (term) */
  sourceText: string;
  /** Side B text (translation) — enables dual-side selection */
  sourceTextB?: string;
  /** Label for side A */
  labelA?: string;
  /** Label for side B */
  labelB?: string;
}

interface PendingHint {
  text: string;
  startIndex?: number;
  endIndex?: number;
  side: SourceSide;
  manual: boolean;
}

export const WordHintEditor = ({
  value,
  onChange,
  sourceText,
  sourceTextB,
  labelA = "Lado A",
  labelB = "Lado B",
}: WordHintEditorProps) => {
  const [isExpanded, setIsExpanded] = useState(value.length > 0);
  const [pending, setPending] = useState<PendingHint | null>(null);
  const [pendingTranslation, setPendingTranslation] = useState("");
  const [pendingNote, setPendingNote] = useState("");
  const [pendingManualText, setPendingManualText] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [hasStaleHints, setHasStaleHints] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualSide, setManualSide] = useState<SourceSide>("A");
  const phraseRefA = useRef<HTMLDivElement>(null);
  const phraseRefB = useRef<HTMLDivElement>(null);
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

  const handleTextSelection = useCallback(
    (side: SourceSide) => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) return;

      const ref = side === "A" ? phraseRefA.current : phraseRefB.current;
      if (!ref) return;

      const range = selection.getRangeAt(0);
      if (!ref.contains(range.commonAncestorContainer)) return;

      const fullText = ref.textContent || "";
      const selectedText = selection.toString().trim();
      if (!selectedText) return;

      // Walk DOM to find exact char offset
      const treeWalker = document.createTreeWalker(ref, NodeFilter.SHOW_TEXT);
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

      const endIndex = startIndex + selectedText.length;
      const verify = fullText.slice(startIndex, endIndex);
      if (verify !== selectedText) return;

      setPending({ text: selectedText, startIndex, endIndex, side, manual: false });
      setPendingTranslation("");
      setPendingNote("");
      setManualMode(false);
      selection.removeAllRanges();

      setTimeout(() => translationInputRef.current?.focus(), 100);
    },
    [value]
  );

  const startManualEntry = useCallback(() => {
    setManualMode(true);
    setPending(null);
    setPendingManualText("");
    setPendingTranslation("");
    setPendingNote("");
    setManualSide("A");
  }, []);

  const confirmManualEntry = useCallback(() => {
    const text = pendingManualText.trim();
    if (!text) return;

    // Try to find exact position in the chosen side's text
    const sideText = manualSide === "A" ? sourceText : (sourceTextB || "");
    const idx = sideText.indexOf(text);

    setPending({
      text,
      startIndex: idx !== -1 ? idx : undefined,
      endIndex: idx !== -1 ? idx + text.length : undefined,
      side: manualSide,
      manual: true,
    });
    setManualMode(false);
    setTimeout(() => translationInputRef.current?.focus(), 100);
  }, [pendingManualText, manualSide, sourceText, sourceTextB]);

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
    setManualMode(false);
  }, []);

  const removeItem = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange]
  );

  const startEditing = useCallback(
    (index: number) => {
      setEditingIndex(index);
      setPendingTranslation(value[index].translation);
      setPendingNote(value[index].note || "");
    },
    [value]
  );

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

  // Render phrase with highlights for bound hints
  const renderPhrase = (text: string, side: SourceSide) => {
    if (!text) return <span className="text-muted-foreground italic">Preencha o campo acima primeiro</span>;

    // Only highlight index-based hints matching this side
    const hintsForSide = value.filter(
      (h) =>
        h.startIndex !== undefined &&
        h.endIndex !== undefined &&
        // For side A, show all indexed hints (default behavior)
        // We store side info in note prefix or just show all on A for backward compat
        side === "A"
    );

    const sortedHints = [...hintsForSide].sort((a, b) => a.startIndex! - b.startIndex!);
    const segments: { text: string; hintIndex?: number }[] = [];
    let cursor = 0;

    for (const hint of sortedHints) {
      const start = hint.startIndex!;
      const end = Math.min(hint.endIndex!, text.length);
      if (start < cursor || start >= text.length) continue;

      if (start > cursor) {
        segments.push({ text: text.slice(cursor, start) });
      }
      const idx = value.indexOf(hint);
      segments.push({ text: text.slice(start, end), hintIndex: idx });
      cursor = end;
    }
    if (cursor < text.length) {
      segments.push({ text: text.slice(cursor) });
    }

    if (sortedHints.length === 0) {
      return <span>{text}</span>;
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

          {/* Side A selectable area */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">
              Selecione um trecho de <strong>{labelA}</strong>:
            </Label>
            <div
              ref={phraseRefA}
              onMouseUp={() => handleTextSelection("A")}
              onTouchEnd={() => handleTextSelection("A")}
              className={cn(
                "p-3 rounded-md border bg-background text-base leading-relaxed select-text cursor-text",
                "min-h-[44px] break-words"
              )}
            >
              {renderPhrase(sourceText, "A")}
            </div>
          </div>

          {/* Side B selectable area */}
          {sourceTextB && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">
                Ou selecione um trecho de <strong>{labelB}</strong>:
              </Label>
              <div
                ref={phraseRefB}
                onMouseUp={() => handleTextSelection("B")}
                onTouchEnd={() => handleTextSelection("B")}
                className={cn(
                  "p-3 rounded-md border bg-background text-base leading-relaxed select-text cursor-text",
                  "min-h-[44px] break-words"
                )}
              >
                {renderPhrase(sourceTextB || "", "B")}
              </div>
            </div>
          )}

          {/* Manual entry toggle */}
          {!pending && !manualMode && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={startManualEntry}
              className="gap-1.5 text-xs"
            >
              <Type className="h-3.5 w-3.5" />
              Digitar trecho manualmente
            </Button>
          )}

          {/* Manual entry form */}
          {manualMode && (
            <div className="p-3 rounded-md border-2 border-muted bg-muted/10 space-y-2 animate-in fade-in-0 slide-in-from-top-1">
              <div className="space-y-1">
                <Label className="text-xs">Lado de origem</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={manualSide === "A" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setManualSide("A")}
                  >
                    {labelA}
                  </Button>
                  <Button
                    type="button"
                    variant={manualSide === "B" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setManualSide("B")}
                  >
                    {labelB}
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Trecho</Label>
                <Input
                  value={pendingManualText}
                  onChange={(e) => setPendingManualText(e.target.value)}
                  placeholder="Digite o trecho da frase..."
                  className="text-sm h-9"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      confirmManualEntry();
                    }
                  }}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={confirmManualEntry} disabled={!pendingManualText.trim()}>
                  Confirmar trecho
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={cancelPending}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {/* Pending selection — translation entry */}
          {pending && (
            <div className="p-3 rounded-md border-2 border-primary/40 bg-primary/5 space-y-2 animate-in fade-in-0 slide-in-from-top-1">
              <p className="text-sm">
                Trecho:{" "}
                <span className="font-semibold text-primary">"{pending.text}"</span>
                <span className="text-xs text-muted-foreground ml-1.5">
                  ({pending.side === "A" ? labelA : labelB})
                </span>
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
                <div key={index} className="flex items-center gap-2 p-2 rounded-md bg-background border text-sm">
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
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id={`suppress-${index}`}
                          checked={(value[index] as any)?.suppressGlobal || false}
                          onCheckedChange={(checked) => {
                            const updated = [...value];
                            (updated[index] as any) = { ...updated[index], suppressGlobal: !!checked };
                            onChange(updated);
                          }}
                        />
                        <Label htmlFor={`suppress-${index}`} className="text-xs text-muted-foreground cursor-pointer">
                          Ocultar tradução global neste contexto
                        </Label>
                      </div>
                      <div className="flex gap-1.5">
                        <Button type="button" size="sm" className="h-7 text-xs" onClick={saveEditing}>
                          Salvar
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            setEditingIndex(null);
                            setPendingTranslation("");
                            setPendingNote("");
                          }}
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
                      {item.note && (
                        <span className="text-xs text-muted-foreground italic truncate max-w-[100px]">({item.note})</span>
                      )}
                      {/* Suppress global toggle */}
                      {(item as any).suppressGlobal && (
                        <span className="text-[9px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1 rounded shrink-0">
                          oculta global
                        </span>
                      )}
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
