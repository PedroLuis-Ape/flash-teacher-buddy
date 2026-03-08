/**
 * InteractiveText — renders text with clickable/hoverable word hints.
 *
 * Desktop: hover to show tooltip, click to pin.
 * Mobile: tap to show popover.
 *
 * If no hints are provided, renders plain text — 100% backward compatible.
 */

import { useState, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { segmentText, parseWordHints, type WordHint } from "@/features/study/lib/wordHints";

interface InteractiveTextProps {
  text: string;
  wordHints?: unknown;
  className?: string;
}

export const InteractiveText = ({ text, wordHints, className }: InteractiveTextProps) => {
  const hints = parseWordHints(wordHints);

  // No hints — render plain text, no overhead
  if (hints.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const segments = segmentText(text, hints);

  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.hint ? (
          <HintWord key={i} value={seg.value} hint={seg.hint} />
        ) : (
          <span key={i}>{seg.value}</span>
        )
      )}
    </span>
  );
};

/** A single highlighted word/expression with a popover */
function HintWord({ value, hint }: { value: string; hint: WordHint }) {
  const [open, setOpen] = useState(false);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen((prev) => !prev);
    },
    []
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <span
          role="button"
          tabIndex={0}
          onClick={handleClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              e.stopPropagation();
              setOpen((prev) => !prev);
            }
          }}
          className={cn(
            "cursor-pointer border-b-2 border-dashed border-primary/50",
            "hover:border-primary hover:text-primary transition-colors",
            "rounded-sm px-0.5 -mx-0.5",
            open && "bg-primary/10 text-primary border-primary"
          )}
        >
          {value}
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        className="w-auto max-w-[240px] p-3 space-y-1"
        onClick={(e) => e.stopPropagation()}
        onPointerDownOutside={() => setOpen(false)}
      >
        <p className="font-semibold text-sm text-foreground">{hint.translation}</p>
        {hint.note && (
          <p className="text-xs text-muted-foreground italic">{hint.note}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
