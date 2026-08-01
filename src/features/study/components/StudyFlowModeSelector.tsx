import { ListChecks, Rows3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudyFlowModePreset } from "@/features/study/preferences/studyPreset";

interface StudyFlowModeSelectorProps {
  value: StudyFlowModePreset;
  onChange: (value: StudyFlowModePreset) => void;
  disabled?: boolean;
  className?: string;
}

const options: Array<{
  value: StudyFlowModePreset;
  title: string;
  description: string;
  icon: typeof ListChecks;
}> = [
  {
    value: "mastery_rounds",
    title: "Rodadas de Domínio",
    description: "Até 15 cards por rodada; erros e dúvidas voltam até serem dominados.",
    icon: ListChecks,
  },
  {
    value: "continuous",
    title: "Percurso completo",
    description: "Jogue todos os cards uma vez, do início ao fim, sem interrupções.",
    icon: Rows3,
  },
];

export function StudyFlowModeSelector({
  value,
  onChange,
  disabled = false,
  className,
}: StudyFlowModeSelectorProps) {
  return (
    <fieldset className={cn("space-y-2", className)} disabled={disabled}>
      <legend className="text-xs font-medium">Formato da sessão</legend>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option) => {
          const Icon = option.icon;
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex min-h-[76px] items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                selected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/40 hover:bg-accent/40",
              )}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{option.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {option.description}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
