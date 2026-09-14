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
  - "[[08-RISKS]]"
---

# Configurações da Sessão — contrato único (2026-09-14)

## Causa raiz (não era só UX)

- [FATO CONFIRMADO] `applyStudySettingsPatch` forçava `order = sequential` no Foco Vermelho mas **não** forçava `studyFlowMode = continuous`; pior, o estado efetivo não era aplicado na derivação do snapshot, então a UI mostrava uma coisa e o motor rodava outra.
- [FATO CONFIRMADO] `useStudySettingsController` persistia `studySettingsToPresetOverride(next)` — o **snapshot inteiro**. Uma mudança gravava as 10 propriedades, inclusive valores vindos de sessão restaurada, e transformava a restrição temporária do Foco Vermelho em preferência salva.

## Decisões vigentes

- [DECISÃO VIGENTE] Foco Vermelho ativo ⇒ estado **efetivo** `order = sequential` + `studyFlowMode = continuous`, aplicado na derivação (`studySettingsFromPreset`) e nos patches. UI e motor leem o mesmo estado.
- [DECISÃO VIGENTE] A preferência base do usuário nunca é sobrescrita pela restrição. Ao desligar, `releaseRedFocusConstraints(next, presetBase)` devolve ordem e formato do preset — sem estado escondido.
- [DECISÃO VIGENTE] **Persistência por patch semântico**: grava-se somente o que o usuário decidiu (`studySettingsSemanticOverride`). Direção e lado da reescrita seguem sendo uma decisão atômica (persistem juntos).
- [DECISÃO VIGENTE] Modal agrupado em **Sessão** (formato, ordem), **Conteúdo e direção** (conteúdo, direção), **Escrita** (só no modo escrever) e **Áudio e exibição**. Resumo de cada categoria mostra só os próprios valores; “Áudio e ritmo” deixou de existir.

## Evidência

- [VERIFIED-TEST] `src/features/study/lib/studySettingsSemantics.contract.test.ts` — 11 casos cobrindo estado efetivo, restauração ao desligar, persistência semântica e classificação de fila.
- [VERIFIED-TEST] Suíte completa: **2007 testes passando** em 317 arquivos; `tsc` exit 0; `eslint` 0 erros nos arquivos tocados; `vite build` ✓.

## O que continua aberto

- [PENDENTE] Política fina de mudança de fila **durante** a sessão (reconciliar sem perder progresso) e validação cruzada Study × MixedStudy: dependem de `Study.tsx`/`MixedStudy.tsx`, que não foram tocados nesta rodada.
- [PENDENTE] O controlador ainda espelha o snapshot efetivo completo em `setSessionOverrides` (comportamento preservado de propósito, para não quebrar a sessão em andamento).

Related: [[00-HOME]] · [[01-CURRENT-STATE]] · [[04-DECISIONS]] · [[07-TESTS]]
