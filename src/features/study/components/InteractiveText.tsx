/**
 * InteractiveText — renders text with hoverable/tappable word hints.
 *
 * Desktop: mouseenter shows tooltip, mouseleave hides it.
 * Mobile: tap shows tooltip, auto-closes after 3s or on outside tap.
 *
 * Supports multi-translation display (global + manual merged hints).
 * If no hints are provided, renders plain text — 100% backward compatible.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { segmentText, parseWordHints, type WordHint } from "@/features/study/lib/wordHints";
import type { MergedHint } from "@/features/study/lib/glossaryMerge";
import { mergedHintsToWordHints } from "@/features/study/lib/glossaryMerge";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { getPerfSettings } from "@/lib/performanceSettings";
import { useTTS } from "@/features/study/hooks/useTTS";

interface InteractiveTextProps {
  text: string;
  wordHints?: unknown;
  /** Pre-merged hints (global + manual). Takes priority over wordHints if provided. */
  mergedHints?: MergedHint[];
  className?: string;
  /** When true, clicking a highlighted glossary word also speaks that specific word/expression. */
  speakOnHintClick?: boolean;
  /** Optional BCP-47 language code used for click-to-speak (e.g. fr-FR, en-US). */
  speakLang?: string;
}

export const InteractiveText = ({ text, wordHints, mergedHints, className, speakOnHintClick = false, speakLang }: InteractiveTextProps) => {
  const { speak } = useTTS();

  // Feature flag OR performance setting: when word hints are disabled, render plain text
  const perf = getPerfSettings();
  if (!FEATURE_FLAGS.word_hints_enabled || !perf.wordTooltips) {
    return <span className={className}>{text}</span>;
  }

  // If mergedHints are provided, use those; otherwise fall back to raw wordHints
  const resolvedHints = mergedHints
    ? mergedHintsToWordHints(mergedHints)
    : parseWordHints(wordHints);

  if (resolvedHints.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const segments = segmentText(text, resolvedHints);

  const handleHintActivate = useCallback((clickedValue: string) => {
    if (!speakOnHintClick) return;
    speak(clickedValue, { langOverride: speakLang });
  }, [speakOnHintClick, speakLang, speak]);

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.hint ? (
          <HintWord
            key={i}
            value={seg.value}
            hint={seg.hint}
            mergedTranslations={(seg.hint as any)._mergedTranslations}
            onActivate={handleHintActivate}
          />
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </span>
  );
};

const MOBILE_AUTO_CLOSE_MS = 3000;

/** A single highlighted word/expression with a lightweight tooltip */
function HintWord({
  value,
  hint,
  mergedTranslations,
  onActivate,
}: {
  value: string;
  hint: WordHint;
  mergedTranslations?: { text: string; note?: string; source: "global" | "manual" }[];
  onActivate?: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-close on mobile after timeout
  useEffect(() => {
    if (!open) return;
    timerRef.current = setTimeout(() => setOpen(false), MOBILE_AUTO_CLOSE_MS);
    return () => clearTimeout(timerRef.current);
  }, [open]);

  // Close on outside tap (mobile)
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handler, true);
    return () => document.removeEventListener("pointerdown", handler, true);
  }, [open]);

  const handleMouseEnter = useCallback(() => setOpen(true), []);
  const handleMouseLeave = useCallback(() => setOpen(false), []);

  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onActivate?.(value);
    setOpen((prev) => !prev);
  }, [onActivate, value]);

  return (
    <span ref={wrapperRef} className="relative inline">
      <span
        role="button"
        tabIndex={0}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleTap}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onActivate?.(value);
            setOpen((prev) => !prev);
          }
        }}
        className={cn(
          "cursor-pointer border-b-2 border-dashed border-primary/50",
          "md:hover:border-primary md:hover:text-primary transition-colors",
          "rounded-sm px-0.5 -mx-0.5",
          open && "bg-primary/10 text-primary border-primary"
        )}
      >
        {value}
      </span>
      {open && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 pointer-events-none
                     w-max max-w-[260px] rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md
                     animate-in fade-in-0 zoom-in-95"
          role="tooltip"
        >
          {mergedTranslations && mergedTranslations.length > 0 ? (
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {mergedTranslations.map((t, i) => (
                <span key={i} className="inline-flex items-baseline gap-1 whitespace-nowrap">
                  {i > 0 && <span className="text-muted-foreground text-xs">·</span>}
                  <span className="font-semibold text-sm leading-tight">{t.text}</span>
                  {t.note && (
                    <span className="text-xs text-muted-foreground italic">({t.note})</span>
                  )}
                </span>
              ))}
            </span>
          ) : (
            <>
              <span className="block font-semibold text-sm">{hint.translation}</span>
              {hint.note && (
                <span className="block text-xs text-muted-foreground italic mt-0.5">{hint.note}</span>
              )}
            </>
          )}
        </span>
      )}
    </span>
  );
}

