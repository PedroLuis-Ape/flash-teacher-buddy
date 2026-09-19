import { useState } from "react";
import { ChevronDown, ChevronUp, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { usePlayPresetRuntime } from "@/features/study/lib/playPresetRuntime";
import type {
  StudyWriteActivityModePreset,
  StudyWriteRewritePromptModePreset,
  StudyWriteRewriteSidePreset,
} from "@/features/study/preferences/studyPreset";

interface WriteActivitySettingsProps {
  /** Valores efetivamente usados pela sessão — vindos do controlador único. */
  activityMode: StudyWriteActivityModePreset;
  rewriteSide: StudyWriteRewriteSidePreset;
  /** Reescrita visual ("visible") x escrever o que ouviu ("listening"). */
  rewritePromptMode: StudyWriteRewritePromptModePreset;
  onChange: (patch: {
    writeActivityMode?: StudyWriteActivityModePreset;
    writeRewritePromptMode?: StudyWriteRewritePromptModePreset;
  }) => void;
}

/**
 * Três experiências para o aluno, mapeadas em DOIS campos do contrato:
 *
 *   Traduzir             -> writeActivityMode = "translate"
 *   Reescrever           -> "rewrite" + writeRewritePromptMode = "visible"
 *   Escrever o que ouviu -> "rewrite" + writeRewritePromptMode = "listening"
 *
 * São atividades irmãs: escrever o que ouviu nunca é uma fase da reescrita.
 */
type WritePracticeOption = "translate" | "rewrite-visible" | "rewrite-listening";

const WRITE_PRACTICE_OPTIONS: { value: WritePracticeOption; label: string }[] = [
  { value: "translate", label: "Traduzir" },
  { value: "rewrite-visible", label: "Reescrever" },
  { value: "rewrite-listening", label: "Escrever o que ouviu" },
];

/**
 * Componente controlado: mantém apenas estado de interface (seção expandida).
 * Não hidrata preferências e não escreve preset por conta própria.
 */
export function WriteActivitySettings({
  activityMode,
  rewriteSide,
  rewritePromptMode,
  onChange,
}: WriteActivitySettingsProps) {
  const playRuntime = usePlayPresetRuntime();
  const [expanded, setExpanded] = useState(false);

  const sideSummary = rewriteSide === "a"
    ? playRuntime.labelA
    : rewriteSide === "b"
      ? playRuntime.labelB
      : "alternando os lados";

  const selectedPractice: WritePracticeOption = activityMode === "translate"
    ? "translate"
    : rewritePromptMode === "listening"
      ? "rewrite-listening"
      : "rewrite-visible";
  const summary = selectedPractice === "translate"
    ? "Traduzir de um lado para o outro"
    : selectedPractice === "rewrite-listening"
      ? `Escrever o que ouviu · ${sideSummary}`
      : `Reescrever vendo o texto · ${sideSummary}`;

  const selectPractice = (option: WritePracticeOption) => {
    if (option === "translate") {
      onChange({ writeActivityMode: "translate" });
      return;
    }
    onChange({
      writeActivityMode: "rewrite",
      writeRewritePromptMode: option === "rewrite-listening" ? "listening" : "visible",
    });
  };

  return (
    <div className="rounded-xl border bg-background/40">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className={cn(
          "flex min-h-[56px] w-full items-center gap-3 rounded-xl px-4 py-3 text-left",
          "hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary/60",
        )}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Copy className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">Atividade de escrita</span>
          <span className="block truncate text-sm text-muted-foreground">{summary}</span>
        </span>
        {expanded
          ? <ChevronUp className="h-5 w-5 shrink-0 text-muted-foreground" />
          : <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="space-y-4 border-t px-4 py-4">
          <div>
            <p className="font-medium">Como você quer praticar?</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Traduza o card, reescreva o texto que está vendo ou escreva o que ouviu no áudio.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {WRITE_PRACTICE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                variant={selectedPractice === option.value ? "default" : "outline"}
                aria-pressed={selectedPractice === option.value}
                data-write-practice-option={option.value}
                onClick={() => selectPractice(option.value)}
                className="h-auto min-h-[44px] whitespace-normal px-3 py-2 text-sm leading-tight"
              >
                {option.label}
              </Button>
            ))}
          </div>

          {activityMode === "rewrite" && (
            // A escolha de lado NÃO se repete aqui: ela pertence à direção
            // única do Study. Este bloco só informa o lado efetivo derivado.
            <p className="text-sm text-muted-foreground">
              Lado praticado: <span className="font-medium text-foreground">{sideSummary}</span>.
              A direção é definida nas configurações de direção do Study.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
