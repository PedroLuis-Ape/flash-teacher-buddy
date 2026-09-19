import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layers3, Lightbulb, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTTS } from "@/features/study/hooks/useTTS";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import { folderGlossaryIdentity } from "@/features/study/lib/folderGlossaryCompact";
import { getSpeechRate } from "./SpeechRateControl";
import {
  buildLayeredTextSegments,
  definitionsFromMergedHints,
  definitionsFromWordHints,
  prioritizeLayeredHintMatches,
  type LayeredHintMatch,
} from "@/features/study/lib/glossaryLayers";
import {
  buildGlossaryNoteTarget,
  GLOSSARY_NOTE_MAX_LENGTH,
  sanitizeGlossaryNote,
} from "@/features/study/lib/glossaryNote";
import { useInGameGlossaryNote } from "@/features/study/hooks/useInGameGlossaryNote";

interface InteractiveTextProps {
  text: string;
  wordHints?: unknown;
  mergedHints?: MergedHint[];
  className?: string;
  speakOnHintClick?: boolean;
  speakLang?: string;
  /** Lado físico do texto renderizado (A = termo, B = tradução). */
  side?: "A" | "B";
}

const normalize = (value: string) => folderGlossaryIdentity(value);

/**
 * 5s é somente a duração do preview por tap no mobile — nunca um timeout de
 * salvamento. Edição, hover e interação cancelam o auto-close.
 */
const NOTE_PREVIEW_MS = 5000;

export const InteractiveText = ({
  text = "",
  wordHints,
  mergedHints,
  className,
  speakOnHintClick = false,
  speakLang,
  side = "A",
}: InteractiveTextProps) => {
  const { speak } = useTTS();
  const safeText = typeof text === "string" ? text : String(text ?? "");

  // Word translations are core learning content. Performance presets may reduce
  // animations and decoration, but they must never turn valid glossary data into
  // plain, non-interactive text.
  const definitions = useMemo(() => {
    if (!FEATURE_FLAGS.word_hints_enabled) return [];
    return mergedHints
      ? definitionsFromMergedHints(mergedHints)
      : definitionsFromWordHints(wordHints);
  }, [mergedHints, wordHints]);

  const segments = useMemo(
    () => buildLayeredTextSegments(safeText, definitions),
    [safeText, definitions],
  );

  const handleHintActivate = useCallback((clickedValue: string) => {
    if (!speakOnHintClick) return;
    const rate = getSpeechRate();
    speak(clickedValue, {
      langOverride: speakLang,
      rate,
      mode: rate === 0.5 ? "word-by-word" : "natural",
    });
  }, [speakOnHintClick, speakLang, speak]);

  return (
    <span className={className}>
      {segments.map((segment, index) => (
        segment.matches.length > 0 ? (
          <LayeredHintToken
            key={`hint-${segment.startIndex}-${segment.endIndex}-${index}`}
            value={segment.value}
            matches={segment.matches}
            side={side}
            onActivate={handleHintActivate}
          />
        ) : (
          <span key={`plain-${segment.startIndex}-${segment.endIndex}-${index}`}>
            {segment.value}
          </span>
        )
      ))}
    </span>
  );
};

function uniqueTranslations(match: LayeredHintMatch) {
  const grouped = new Map<string, {
    text: string;
    note?: string;
    source: "global" | "manual";
  }>();

  for (const translation of match.translations) {
    const key = normalize(translation.text);
    if (!key) continue;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, { ...translation });
      continue;
    }

    const notes = [existing.note, translation.note]
      .filter((note): note is string => Boolean(note?.trim()));
    const uniqueNotes = Array.from(new Map(
      notes.map((note) => [normalize(note), note.trim()]),
    ).values());

    grouped.set(key, {
      text: existing.text,
      note: uniqueNotes.join(" · ") || undefined,
      source: existing.source === "manual" || translation.source === "manual"
        ? "manual"
        : "global",
    });
  }

  return Array.from(grouped.values());
}

interface GlossaryNoteApi {
  canAnnotate: boolean;
  isSaving: boolean;
  /** true quando o card atual foi resolvido e o banco é autoritativo. */
  isAuthoritative: boolean;
  readNote: (target: ReturnType<typeof buildGlossaryNoteTarget>) => string;
  saveNote: (target: ReturnType<typeof buildGlossaryNoteTarget>, note: string) => Promise<void>;
}

function useGlossaryNoteApi(): GlossaryNoteApi {
  const { canAnnotate, isSaving, readNote, saveNote, sourceCardId } = useInGameGlossaryNote();
  return {
    canAnnotate,
    isSaving,
    isAuthoritative: Boolean(sourceCardId),
    readNote,
    saveNote,
  };
}

function GlossaryEntry({
  match,
  value,
  side,
  noteApi,
}: {
  match: LayeredHintMatch;
  value: string;
  side: "A" | "B";
  noteApi: GlossaryNoteApi;
}) {
  const translations = uniqueTranslations(match);
  const isExact = normalize(match.text) === normalize(value);
  const isExpression = /\s/u.test(match.text.trim());
  const target = useMemo(
    () => buildGlossaryNoteTarget(match, side, translations[0]?.text ?? match.text),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [match, side, translations[0]?.text],
  );

  const personalNote = noteApi.isAuthoritative ? noteApi.readNote(target).trim() : "";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewPinned, setPreviewPinned] = useState(false);
  const [previewHovered, setPreviewHovered] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) return;
    if (!previewOpen || previewPinned || previewHovered || editing) return;
    const timer = window.setTimeout(() => setPreviewOpen(false), NOTE_PREVIEW_MS);
    return () => window.clearTimeout(timer);
  }, [editing, isMobile, previewHovered, previewOpen, previewPinned]);

  const openEditor = useCallback(() => {
    // Editar cancela completamente o auto-close do preview.
    setPreviewOpen(false);
    setPreviewPinned(false);
    setPreviewHovered(false);
    setDraft(personalNote);
    setError(null);
    setEditing(true);
  }, [personalNote]);

  const cancelEditor = useCallback(() => {
    setEditing(false);
    setDraft("");
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    try {
      await noteApi.saveNote(target, sanitizeGlossaryNote(draft));
      setEditing(false);
      setDraft("");
    } catch (saveError) {
      // Em erro o texto digitado é preservado para nova tentativa.
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a anotação.");
    }
  }, [draft, noteApi, target]);

  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();

  return (
    <section
      data-glossary-entry="true"
      className="space-y-2.5 px-4 py-3.5 sm:px-5 sm:py-4"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 break-words text-sm font-semibold leading-snug text-foreground sm:text-base">
          {match.expression ?? match.text}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {personalNote && (
            <button
              type="button"
              data-glossary-note-lightbulb="true"
              aria-label="Ver anotação de uso"
              title="Ver anotação de uso"
              aria-expanded={previewOpen}
              onPointerDown={stop}
              onClick={(event) => {
                event.stopPropagation();
                setPreviewHovered(false);
                if (isMobile) {
                  setPreviewPinned(false);
                  setPreviewOpen((current) => !current);
                  return;
                }
                setPreviewPinned(!(previewOpen && previewPinned));
                setPreviewOpen(true);
              }}
              onMouseEnter={() => {
                if (isMobile) return;
                setPreviewHovered(true);
                setPreviewOpen(true);
              }}
              onMouseLeave={() => {
                if (isMobile) return;
                setPreviewHovered(false);
                if (!previewPinned) setPreviewOpen(false);
              }}
              className={cn(
                "inline-flex h-11 w-11 items-center justify-center rounded-full text-amber-600 transition-colors hover:bg-amber-500/10 dark:text-amber-300",
                previewOpen && "bg-amber-500/15",
              )}
            >
              <Lightbulb className="h-4 w-4" />
            </button>
          )}
          <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground sm:text-[10px]">
            {match.scope === "contextual" ? "neste contexto" : isExpression || match.kind === "expression" ? "expressão" : isExact ? "significado base" : "relacionada"}
          </span>
        </span>
      </div>

      {previewOpen && personalNote && (
        <div
          data-glossary-note-preview="true"
          onPointerDown={stop}
          onClick={stop}
          onMouseEnter={() => { if (!isMobile) setPreviewHovered(true); }}
          onMouseLeave={() => { if (!isMobile) setPreviewHovered(false); }}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-300">
              <Lightbulb className="h-3 w-3" />
              Anotação pessoal
            </span>
            <button
              type="button"
              aria-label="Fechar anotação"
              onClick={(event) => {
                event.stopPropagation();
                setPreviewOpen(false);
                setPreviewPinned(false);
              }}
              className="-mr-1 -mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
            {personalNote}
          </p>
        </div>
      )}

      <div className="space-y-2.5">
        {translations.map((translation) => {
          // Com o card resolvido, a anotação pessoal vem do banco e a nota
          // manual antiga do merge não é reapresentada como texto congelado.
          const showNote = Boolean(translation.note)
            && !(noteApi.isAuthoritative && translation.source === "manual");
          return (
            <div key={normalize(translation.text)} className="min-w-0">
              <p className="break-words text-sm font-medium leading-relaxed sm:text-base">
                {translation.text}
              </p>
              {showNote && (
                <p className="mt-1 break-words text-xs italic leading-relaxed text-muted-foreground sm:text-sm">
                  {translation.note}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {noteApi.canAnnotate && !editing && (
        <button
          type="button"
          data-glossary-note-action="true"
          aria-label={personalNote ? "Editar anotação de uso" : "Adicionar anotação de uso"}
          onPointerDown={stop}
          onClick={(event) => {
            event.stopPropagation();
            openEditor();
          }}
          className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <Lightbulb className="h-3.5 w-3.5" />
          {personalNote ? "Editar anotação" : "Adicionar anotação"}
        </button>
      )}

      {noteApi.canAnnotate && editing && (
        <div
          data-glossary-note-editor="true"
          onPointerDown={stop}
          onClick={stop}
          className="space-y-2"
        >
          <label
            htmlFor={`glossary-note-${match.key}`}
            className="block text-[10px] font-bold uppercase tracking-wide text-muted-foreground"
          >
            Anotação de uso
          </label>
          <Textarea
            id={`glossary-note-${match.key}`}
            value={draft}
            autoFocus
            rows={3}
            maxLength={GLOSSARY_NOTE_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Como esta palavra é usada aqui?"
            className="min-h-[72px] w-full resize-y text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              className="min-h-11 rounded-xl"
              disabled={noteApi.isSaving}
              onClick={() => { void handleSave(); }}
            >
              Salvar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="min-h-11 rounded-xl"
              disabled={noteApi.isSaving}
              onClick={cancelEditor}
            >
              Cancelar
            </Button>
            <span className="ml-auto text-[10px] text-muted-foreground">
              {draft.length}/{GLOSSARY_NOTE_MAX_LENGTH}
            </span>
          </div>
          {error && (
            <p role="alert" className="text-xs text-destructive">{error}</p>
          )}
        </div>
      )}
    </section>
  );
}

function GlossaryPanel({
  value,
  matches,
  side,
  noteApi,
  mobile = false,
}: {
  value: string;
  matches: LayeredHintMatch[];
  side: "A" | "B";
  noteApi: GlossaryNoteApi;
  mobile?: boolean;
}) {
  const prioritized = prioritizeLayeredHintMatches(value, matches);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? prioritized : prioritized.slice(0, 3);
  const hiddenCount = Math.max(0, prioritized.length - visible.length);

  return (
    <div
      className={cn(
        "flex min-h-0 w-full flex-col overflow-hidden bg-background",
        mobile ? "h-full" : "max-h-[min(24rem,calc(100dvh-2rem))]",
      )}
      data-testid="folder-glossary-panel"
    >
      <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground sm:text-xs">
            Glossário
          </p>
          <p className="truncate text-base font-semibold sm:text-lg">{value}</p>
        </div>
        {prioritized.length > 1 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary sm:text-xs">
            <Layers3 className="h-3.5 w-3.5" />
            {prioritized.length} camadas
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain scroll-pb-4">
        {visible.map((match) => (
          <GlossaryEntry
            key={`${match.key}-${match.startIndex}-${match.endIndex}`}
            match={match}
            value={value}
            side={side}
            noteApi={noteApi}
          />
        ))}

        {hiddenCount > 0 && (
          <Button variant="ghost" onClick={() => setExpanded(true)} className="min-h-[44px] shrink-0">
            Mostrar mais ({hiddenCount})
          </Button>
        )}
      </div>
    </div>
  );
}

function LayeredHintToken({
  value,
  matches,
  side,
  onActivate,
}: {
  value: string;
  matches: LayeredHintMatch[];
  side: "A" | "B";
  onActivate?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const noteApi = useGlossaryNoteApi();
  const layerCount = prioritizeLayeredHintMatches(value, matches).length;

  const trigger = (
    <button
      type="button"
      className={cn(
        "inline cursor-pointer rounded-sm border-0 border-b-2 border-dashed border-primary/55 bg-transparent px-0.5 py-0 font-inherit text-inherit -mx-0.5",
        "transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        open && "border-primary bg-primary/10 text-primary",
        layerCount > 1 && "border-b-[3px] border-double",
      )}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onActivate?.(value);
      }}
      aria-label={`${value}: abrir ${layerCount} entrada${layerCount === 1 ? "" : "s"} do glossário da pasta`}
    >
      {value}
    </button>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent
          side="bottom"
          data-glossary-sheet="true"
          className="z-[80] flex max-h-[min(86dvh,44rem)] w-full flex-col gap-0 overflow-hidden rounded-t-3xl border-t bg-background p-0 shadow-2xl [&>button.absolute]:hidden"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onTouchStart={(event) => event.stopPropagation()}
          onTouchMove={(event) => event.stopPropagation()}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Glossário da pasta: {value}</SheetTitle>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            <GlossaryPanel value={value} matches={matches} side={side} noteApi={noteApi} mobile />
          </div>
          <div className="shrink-0 border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <SheetClose asChild>
              <Button variant="outline" className="min-h-[44px] w-full rounded-xl">
                <X className="mr-2 h-4 w-4" />
                Fechar
              </Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="center"
        sideOffset={8}
        collisionPadding={20}
        className="z-[80] flex w-[min(22rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] flex-col overflow-hidden bg-background p-0 shadow-xl"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <GlossaryPanel value={value} matches={matches} side={side} noteApi={noteApi} />
      </PopoverContent>
    </Popover>
  );
}

