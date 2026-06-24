import { useCallback, useMemo, useState } from "react";
import { Layers3, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { getPerfSettings } from "@/lib/performanceSettings";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTTS } from "@/features/study/hooks/useTTS";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import { getSpeechRate } from "./SpeechRateControl";
import {
  buildLayeredTextSegments,
  definitionsFromMergedHints,
  definitionsFromWordHints,
  type LayeredHintMatch,
} from "@/features/study/lib/glossaryLayers";

interface InteractiveTextProps {
  text: string;
  wordHints?: unknown;
  mergedHints?: MergedHint[];
  className?: string;
  speakOnHintClick?: boolean;
  speakLang?: string;
}

const normalize = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLocaleLowerCase();

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
    return mergedHints
      ? definitionsFromMergedHints(mergedHints)
      : definitionsFromWordHints(wordHints);
  }, [hintsDisabled, mergedHints, wordHints]);

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

function prioritizedMatches(value: string, matches: LayeredHintMatch[]) {
  const clicked = normalize(value);
  const exact = matches.filter((match) => normalize(match.text) === clicked);
  const candidates = exact.length > 0 ? exact : matches;
  const grouped = new Map<string, LayeredHintMatch>();

  for (const match of candidates) {
    const key = normalize(match.text);
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, {
        ...match,
        translations: [...match.translations],
      });
      continue;
    }

    existing.translations.push(...match.translations);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    const aExpression = /\s/u.test(a.text.trim()) ? 1 : 0;
    const bExpression = /\s/u.test(b.text.trim()) ? 1 : 0;
    if (aExpression !== bExpression) return aExpression - bExpression;
    return a.text.length - b.text.length || a.text.localeCompare(b.text);
  });
}

function GlossaryPanel({
  value,
  matches,
  mobile = false,
}: {
  value: string;
  matches: LayeredHintMatch[];
  mobile?: boolean;
}) {
  const prioritized = prioritizedMatches(value, matches);
  const visible = prioritized.slice(0, 3);
  const hiddenCount = Math.max(0, prioritized.length - visible.length);

  return (
    <div className={cn("flex min-h-0 flex-col bg-background", mobile && "max-h-[72dvh]")}>
      <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-background px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Glossário da pasta
          </p>
          <p className="truncate text-base font-semibold">{value}</p>
        </div>
        {prioritized.length > 1 && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
            <Layers3 className="h-3 w-3" />
            {prioritized.length} camadas
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 divide-y overflow-y-auto overscroll-contain">
        {visible.map((match) => {
          const translations = uniqueTranslations(match);
          const isExact = normalize(match.text) === normalize(value);
          const isExpression = /\s/u.test(match.text.trim());

          return (
            <section
              key={`${match.key}-${match.startIndex}-${match.endIndex}`}
              className="space-y-2 px-4 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 break-words text-sm font-semibold text-foreground">
                  {match.text}
                </span>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
                  {isExact ? "exata" : isExpression ? "expressão" : "relacionada"}
                </span>
              </div>

              <div className="space-y-2">
                {translations.map((translation) => (
                  <div key={normalize(translation.text)}>
                    <p className="text-sm font-medium leading-snug">
                      {translation.text}
                    </p>
                    {translation.note && (
                      <p className="mt-1 text-xs italic leading-relaxed text-muted-foreground">
                        {translation.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {hiddenCount > 0 && (
          <p className="px-4 py-3 text-xs text-muted-foreground">
            {hiddenCount} camada{hiddenCount === 1 ? "" : "s"} adicional
            {hiddenCount === 1 ? "" : "is"} foi ocultada para manter a leitura organizada.
          </p>
        )}
      </div>
    </div>
  );
}

function LayeredHintToken({
  value,
  matches,
  onActivate,
}: {
  value: string;
  matches: LayeredHintMatch[];
  onActivate?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const layerCount = prioritizedMatches(value, matches).length;

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
          className="max-h-[78dvh] rounded-t-2xl border-t bg-background p-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Glossário da pasta: {value}</SheetTitle>
          </SheetHeader>
          <GlossaryPanel value={value} matches={matches} mobile />
          <div className="shrink-0 border-t bg-background px-4 py-3">
            <SheetClose asChild>
              <Button variant="outline" className="w-full">
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
        collisionPadding={12}
        className="w-[min(19rem,calc(100vw-1.5rem))] max-h-[min(18rem,60vh)] overflow-hidden bg-background p-0 shadow-lg"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <GlossaryPanel value={value} matches={matches} />
      </PopoverContent>
    </Popover>
  );
}
