import { ArrowLeftRight, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { buildStudyDirectionOptions } from "@/features/study/lib/studyDirectionSelector";
import { normalizeDirection, type Direction } from "@/features/study/lib/resolveStudySides";
import type { StudyDirectionLabels } from "@/features/study/lib/studyDirectionSelector";
export type { StudyDirectionLabels } from "@/features/study/lib/studyDirectionSelector";

interface StudyDirectionSelectorProps {
  direction: Direction | string;
  labels: StudyDirectionLabels;
  onChange: (direction: Direction) => void;
  disabled?: boolean;
  lockedMessage?: string;
  variant?: "select" | "buttons";
  label?: string;
  className?: string;
  selectClassName?: string;
}

/**
 * Shared direction UI. Games Hub, in-session settings and the compact in-game
 * control all consume this component so labels and A/B/any semantics cannot
 * drift between surfaces.
 */
export function StudyDirectionSelector({
  direction,
  labels,
  onChange,
  disabled = false,
  lockedMessage,
  variant = "select",
  label = "Direção",
  className,
  selectClassName,
}: StudyDirectionSelectorProps) {
  const normalizedDirection = normalizeDirection(direction);
  const options = buildStudyDirectionOptions(labels);
  const effectiveDisabled = disabled || Boolean(lockedMessage);

  return (
    <div className={cn("space-y-1.5", className)}>
      {label && <label className="block text-xs font-medium">{label}</label>}
      {variant === "select" ? (
        <Select
          value={normalizedDirection}
          onValueChange={(value) => onChange(normalizeDirection(value))}
          disabled={effectiveDisabled}
        >
          <SelectTrigger className={cn("h-10", selectClassName)} aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <div className="grid grid-cols-1 gap-2" role="group" aria-label={label}>
          {options.map((option) => (
            <Button
              key={option.value}
              type="button"
              disabled={effectiveDisabled}
              variant={normalizedDirection === option.value ? "default" : "outline"}
              aria-pressed={normalizedDirection === option.value}
              aria-label={option.label}
              onClick={() => onChange(option.value)}
              className="min-h-[44px] justify-start"
              data-direction-option={option.value}
            >
              {option.value === "any" ? (
                <Shuffle className="mr-2 h-4 w-4 shrink-0" />
              ) : (
                <ArrowLeftRight className="mr-2 h-4 w-4 shrink-0" />
              )}
              <span className="truncate">{option.label}</span>
            </Button>
          ))}
        </div>
      )}
      {lockedMessage && (
        <p className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-muted-foreground" role="status">
          {lockedMessage}
        </p>
      )}
    </div>
  );
}
