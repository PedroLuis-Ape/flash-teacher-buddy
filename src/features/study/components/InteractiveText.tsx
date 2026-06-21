import { useCallback, useEffect, useMemo, useState } from "react";
import { Layers3 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { getPerfSettings } from "@/lib/performanceSettings";
import { useTTS } from "@/features/study/hooks/useTTS";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
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
    speak(clickedValue, { langOverride: speakLang });
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
          <span key={`plain-${segment.startIndex}-${segment.endIndex}-${index}`}>{segment.value}</span>
        )
      ))}
    </span>
  );
};

function uniqueTranslations(match: LayeredHintMatch) {
  const seen = new Set<string>();
  return match.translations.filter((translation) => {
    const key = `${translation.text.trim().toLocaleLowerCase()}|${translation.note ?? ""}|${translation.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const layerCount = matches.length;

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setOpen(false), 5000);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
          aria-label={`${value}: abrir ${layerCount} entrada${layerCount === 1 ? "" : "s"} do glossário`}
        >
          {value}
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        collisionPadding={12}
        className="w-[min(18rem,calc(100vw-1.5rem))] max-h-[min(20rem,62vh)] overflow-y-auto p-0 shadow-lg"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-popover px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Tradução</p>
            <p className="truncate text-sm font-semibold">{value}</p>
          </div>
          {layerCount > 1 && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
              <Layers3 className="h-3 w-3" />
              {layerCount}
            </span>
          )}
        </div>

        <div className="divide-y">
          {matches.map((match) => {
            const translations = uniqueTranslations(match);
            return (
              <div key={`${match.key}-${match.startIndex}-${match.endIndex}`} className="space-y-1.5 px-3 py-2.5">
                {translations.map((translation, index) => (
                  <div key={`${translation.text}-${translation.source}-${index}`}>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-snug">{translation.text}</span>
                      {layerCount > 1 && (
                        <span className="shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground">
                          {translation.source === "manual" ? "card" : "lista"}
                        </span>
                      )}
                    </div>
                    {translation.note && (
                      <p className="mt-1 text-xs italic leading-relaxed text-muted-foreground">{translation.note}</p>
                    )}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
