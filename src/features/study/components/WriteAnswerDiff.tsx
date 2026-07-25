import type { AnswerDifference } from "@/features/study/lib/writeAnswerEvaluation";
import { cn } from "@/lib/utils";

interface WriteAnswerDiffProps {
  differences: AnswerDifference[];
  className?: string;
  ariaLabel?: string;
}

/**
 * Renderização palavra a palavra do alinhamento entre resposta esperada
 * e resposta do aluno. Não depende só de cor — usa também símbolo, título
 * e aria-label para acessibilidade.
 */
export function WriteAnswerDiff({ differences, className, ariaLabel }: WriteAnswerDiffProps) {
  if (!differences.length) return null;

  return (
    <p
      className={cn("flex flex-wrap gap-1.5 break-words text-base leading-relaxed", className)}
      aria-label={ariaLabel ?? "Comparação da resposta"}
    >
      {differences.map((diff, index) => {
        const key = `${diff.type}-${index}`;
        switch (diff.type) {
          case "correct":
            return (
              <span
                key={key}
                className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 font-medium text-emerald-700 dark:text-emerald-300"
                aria-label={`palavra correta: ${diff.received ?? diff.expected}`}
                title="Correta"
              >
                {diff.received ?? diff.expected}
              </span>
            );
          case "typo":
            return (
              <span
                key={key}
                className="rounded-md border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-700 dark:text-amber-300"
                title={`Erro de digitação — correto: ${diff.expected}`}
                aria-label={`erro de digitação: você escreveu ${diff.received}, correto é ${diff.expected}`}
              >
                <span className="line-through decoration-amber-700/60">{diff.received}</span>
                <span aria-hidden="true"> → </span>
                <span>{diff.expected}</span>
              </span>
            );
          case "replaced":
            return (
              <span
                key={key}
                className="rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-semibold text-destructive"
                title={`Palavra trocada — esperado: ${diff.expected}`}
                aria-label={`palavra trocada: você escreveu ${diff.received}, esperado ${diff.expected}`}
              >
                <span className="line-through decoration-destructive/60">{diff.received}</span>
                <span aria-hidden="true"> → </span>
                <span>{diff.expected}</span>
              </span>
            );
          case "missing":
            return (
              <span
                key={key}
                className="rounded-md border border-dashed border-amber-500/50 bg-amber-500/5 px-1.5 py-0.5 font-semibold text-amber-800 dark:text-amber-200"
                title="Palavra ausente"
                aria-label={`palavra ausente: ${diff.expected}`}
              >
                <span aria-hidden="true">＋ </span>
                {diff.expected}
              </span>
            );
          case "extra":
            return (
              <span
                key={key}
                className="rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-semibold text-destructive line-through"
                title="Palavra extra"
                aria-label={`palavra extra: ${diff.received}`}
              >
                {diff.received}
              </span>
            );
          default:
            return null;
        }
      })}
    </p>
  );
}