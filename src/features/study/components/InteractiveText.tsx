import { useCallback, useMemo, useState } from "react";
import { Layers3, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { getPerfSettings } from "@/lib/performanceSettings";
import { useTTS } from "@/features/study/hooks/useTTS";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import { getSpeechRate } from "./SpeechRateControl";
import {
  buildLayeredTextSegments,
  definitionsFromMergedHints,
  definitionsFromWordHints,
  type LayeredHintMatch,
} from "@/features/study/lib/glossaryLayers";

const normalizeLayeredText = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

interface InteractiveTextProps {
  text: string;
  wordHints?: unknown;
  mergedHints?: MergedHint[];
  className?: string;
  speakOnHintClick?: boolean;
  speakLang?: string;
}

export const InteractiveText = ({
  text = "",
  wordHints,
  mergedHints,
  className,
  speakOnHintClick = false,
  speakLang,
}: InteractiveTextProps) => {
  const { speak } = useTTS();
  const safeText = typeof text === "string" ? text : String(text ?? "");
  const perf = getPerfSettings();
  const hintsDisabled = !FEATURE_FLAGS.word_hints_enabled || !perf.wordTooltips;

  const definitions = useMemo(() => {
    if (hintsDisabled) return [];
    return mergedHints ? definitionsFromMergedHints(mergedHints) : definitionsFromWordHints(wordHints);
  }, [hintsDisabled, mergedHints, wordHints]);

  const segments = useMemo(() => buildLayeredTextSegments(safeText, definitions), [safeText, definitions]);

  const handleHintActivate = useCallback((clickedValue: string) => {
    if (!speakOnHintClick) return;
    const rate = getSpeechRate();
    speak(clickedValue, { langOverride: speakLang, rate, mode: rate === 0.5 ? "word-by-word" : "natural" });
  }, [speakOnHintClick, speakLang, speak]);

  return (
    <span className={className}>
      {segments.map((segment, index) => (
        segment.matches.length > 0 ? (
          <LayeredHintToken key={`hint-${segment.startIndex}-${segment.endIndex}-${index}`} value={segment.value} matches={segment.matches} onActivate={handleHintActivate} />
        ) : (
          <span key={`plain-${segment.startIndex}-${segment.endIndex}-${index}`}>{segment.value}</span>
        )
      ))}
    </span>
  );
};

interface DisplayTranslation {
  text: string;
  notes: string[];
}

function uniqueTranslations(match: LayeredHintMatch): DisplayTranslation[] {
  const map = new Map<string, DisplayTranslation>();
  for (const translation of match.translations) {
    const cleanText = translation.text.trim();
    if (!cleanText) continue;
    const key = normalizeLayeredText(cleanText);
    const item = map.get(key) ?? { text: cleanText, notes: [] };
    if (translation.note && !item.notes.some((note) => normalizeLayeredText(note) === normalizeLayeredText(translation.note!))) {
      item.notes.push(translation.note);
    }
    map.set(key, item);
  }
  return Array.from(map.values());
}

function orderedMatches(clickedValue: string, matches: LayeredHintMatch[]) {
  const clicked = normalizeLayeredText(clickedValue);
  return [...matches].sort((a, b) => {
    const exactA = normalizeLayeredText(a.text) === clicked ? 0 : 1;
    const exactB = normalizeLayeredText(b.text) === clicked ? 0 : 1;
    if (exactA !== exactB) return exactA - exactB;
    const lengthA = a.endIndex - a.startIndex;
    const lengthB = b.endIndex - b.startIndex;
    return lengthA - lengthB || a.text.localeCompare(b.text);
  }).slice(0, 4);
}

function LayeredHintContent({ value, matches, onClose }: { value: string; matches: LayeredHintMatch[]; onClose?: () => void }) {
  const visibleMatches = orderedMatches(value, matches);
  const hiddenCount = Math.max(0, matches.length - visibleMatches.length);
  const layerCount = matches.length;

  return (
    <div className="max-h-[min(28rem,calc(100dvh-7rem))] overflow-y-auto bg-background text-foreground sm:max-h-[min(22rem,66vh)]">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Glossário da pasta</p>
          <p className="truncate text-sm font-semibold">{value}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {layerCount > 1 && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary"><Layers3 className="h-3 w-3" />{layerCount} camadas</span>}
          {onClose && <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} aria-label="Fechar glossário"><X className="h-4 w-4" /></Button>}
        </div>
      </div>

      <div className="divide-y">
        {visibleMatches.map((match) => {
          const translations = uniqueTranslations(match);
          const isExpression = /\s/u.test(match.text.trim());
          const isExact = normalizeLayeredText(match.text) === normalizeLayeredText(value);
          return (
            <div key={`${match.key}-${match.startIndex}-${match.endIndex}`} className="space-y-2 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-words text-xs font-semibold text-foreground">{match.text}</span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{isExact ? "exata" : isExpression ? "expressão" : "relacionada"}</span>
              </div>
              {translations.map((translation, index) => (
                <div key={`${normalizeLayeredText(translation.text)}-${index}`}>
                  <span className="text-sm font-medium leading-snug">{translation.text}</span>
                  {translation.notes.length > 0 && <p className="mt-1 text-xs italic leading-relaxed text-muted-foreground">{translation.notes.join(" · ")}</p>}
                </div>
              ))}
            </div>
          );
        })}
        {hiddenCount > 0 && <p className="px-3 py-2 text-xs text-muted-foreground">+{hiddenCount} camada(s) relacionada(s) ocultas para manter a leitura limpa.</p>}
      </div>
    </div>
  );
}

function LayeredHintToken({ value, matches, onActivate }: { value: string; matches: LayeredHintMatch[]; onActivate?: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const layerCount = matches.length;
  const activate = () => { setOpen(true); onActivate?.(value); };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn("inline cursor-pointer rounded-sm border-0 border-b-2 border-dashed border-primary/55 bg-transparent px-0.5 py-0 font-inherit text-inherit -mx-0.5", "transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50", open && "border-primary bg-primary/10 text-primary", layerCount > 1 && "border-b-[3px] border-double")}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => { event.stopPropagation(); activate(); }}
            aria-label={`${value}: abrir ${layerCount} entrada${layerCount === 1 ? "" : "s"} do glossário`}
          >{value}</button>
        </PopoverTrigger>
        <PopoverContent side="top" align="center" sideOffset={8} collisionPadding={12} className="hidden w-[min(20rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border bg-background p-0 shadow-xl sm:block" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <LayeredHintContent value={value} matches={matches} />
        </PopoverContent>
      </Popover>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent hideClose className="fixed bottom-0 left-0 top-auto z-50 max-h-[calc(100dvh-2rem)] w-full max-w-none translate-x-0 translate-y-0 rounded-t-2xl border bg-background p-0 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-2xl data-[state=open]:slide-in-from-bottom-full sm:hidden" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
          <DialogTitle className="sr-only">Glossário da pasta</DialogTitle>
          <LayeredHintContent value={value} matches={matches} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}
