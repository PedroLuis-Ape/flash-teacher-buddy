---
cssclasses:
  - ape-ai-note
type: session-checkpoint
status: active
date: 2026-09-14
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[04-DECISIONS]]"
  - "[[07-TESTS]]"
  - "[[areas/motion-system]]"
---

# Roteador único de comandos de teclado (P0 do plano de reforma)

## Problema (causa estrutural, não “faltou um if”)

- [FATO CONFIRMADO] O teclado da sessão tinha VÁRIOS donos: `Study` (atalhos globais), `FlipStudyView`, `MultipleChoiceStudyView`, `UnscrambleStudyView`, `PronunciationStudyView`, `StudyCardDeck` (listener em capture), painéis de explicação (capture) e o `onKeyDown` do Textarea no `Write`.
- [FATO CONFIRMADO] Existia `isTypingTarget()` e o hook global já filtrava campo de texto — mas a proteção era por componente. No preset gamer (`D`=próximo, `A`=anterior, `W`=virar, `Q`=pular, `R`=reiniciar, `E`/`S`=sabia/não sabia) metade do alfabeto vira comando; qualquer handler que esquecesse o filtro, usasse capture ou perdesse o foco num re-render quebrava a digitação.

## Decisão vigente

- [DECISÃO VIGENTE] O teclado tem **um dono único**: `src/features/study/lib/keyboardCommandRouter.ts`, com escada explícita `modal > text-entry > feedback > activity > session` — o escopo mais restrito vence.
- [DECISÃO VIGENTE] `useKeyboardShortcuts` (usado por Study/Flip/MC/Unscramble/Pronunciation) sempre consulta `shouldBlockSessionShortcut` antes de disparar.
- [DECISÃO VIGENTE] Listeners em **capture** também usam a mesma regra, para não passarem na frente do campo de texto.
- [DECISÃO VIGENTE] O Write declara o próprio escopo (`write-answer`): `text-entry` enquanto digita, `feedback` depois de enviar. O comportamento deixa de depender de onde o foco está no keydown.
- [DECISÃO VIGENTE] Modal aberto é detectado no documento (`role=dialog[data-state=open]`), sem instrumentar cada diálogo.

## Evidência

- [VERIFIED-TEST] `keyboardCommandRouter.contract.test.ts` (7 casos): `text-entry` barra `Q A W D R F E S` e espaço; `Enter` só passa com exceção explícita; `feedback` libera; prioridade entre donos; modal bloqueia e `ignoreModal` permite o handler do próprio modal.
- [VERIFIED-TEST] Suíte completa: **2014 testes passando** em 318 arquivos; `tsc` exit 0; `eslint` 0 erros; `vite build` ✓.

## Fila do plano de reforma (ordem acordada)

- [PENDENTE] 1. Keyboard/Input Command Router — **feito nesta rodada**.
- [PENDENTE] 2. TTS Runtime (P0).
- [PENDENTE] 3. Gestos/swipe (P0).
- [PENDENTE] 4. Study Runtime único.
- [PENDENTE] 5. StudyViewportShell / responsividade.
- [PENDENTE] 6. Unificação Study/Mixed.
- [PENDENTE] 7. Reforma das configurações (núcleo feito em [[sessions/2026-09-14-configuracoes-da-sessao]]).
- [PENDENTE] 8. Limpeza dos hacks/CSS legado.

Related: [[00-HOME]] · [[01-CURRENT-STATE]] · [[04-DECISIONS]] · [[07-TESTS]]
