import { useEffect, useRef } from "react";
import {
  evaluateTypeToAnswerKey,
  readTypeToAnswerEnvironment,
} from "@/features/study/lib/typeToAnswer";

export interface UseTypeToAnswerOptions {
  /** O estado atual realmente espera resposta textual. */
  enabled: boolean;
  /** Campo canônico de resposta do modo. */
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement>;
  /**
   * Recebe o caractere digitado. O hook faz `preventDefault`, então o navegador
   * NÃO insere o caractere sozinho — quem insere é este callback, uma única vez.
   */
  onCapture: (character: string) => void;
}

/**
 * Foco por digitação (não autofocus). Sem isto o aluno precisava clicar na
 * caixa antes de escrever; com autofocus por card o teclado virtual do celular
 * abriria sozinho. Aqui o campo só recebe foco quando alguém realmente digita
 * um caractere imprimível em teclado físico.
 */
export function useTypeToAnswer({ enabled, inputRef, onCapture }: UseTypeToAnswerOptions): void {
  const enabledRef = useRef(enabled);
  const onCaptureRef = useRef(onCapture);
  enabledRef.current = enabled;
  onCaptureRef.current = onCapture;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      const input = inputRef.current;
      if (!input || input.disabled) return;
      const decision = evaluateTypeToAnswerKey(
        {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          isComposing: event.isComposing,
          target: event.target,
        },
        { enabled: enabledRef.current, ...readTypeToAnswerEnvironment() },
      );
      if (!decision.capture) return;

      // Impede a inserção nativa: o caractere entra exatamente uma vez via
      // callback controlado do React.
      event.preventDefault();
      input.focus();
      onCaptureRef.current(event.key);
      // Caret ao fim depois do estado atualizar.
      requestAnimationFrame(() => {
        const node = inputRef.current;
        if (!node) return;
        const length = node.value.length;
        try {
          node.setSelectionRange(length, length);
        } catch {
          /* noop */
        }
      });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [inputRef]);
}
