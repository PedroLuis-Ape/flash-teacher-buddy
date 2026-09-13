---
cssclasses:
  - ape-ai-note
---

# Estudo — orientação efetiva A/B, labels e TTS — 2026-09-13

## Estado e fonte da verdade

- [FATO CONFIRMADO] Worktree: `C:\Users\pedro\Documents\App-Piteco-Worktrees\ape-discovery-activation-20260913`.
- [FATO CONFIRMADO] Branch: `integration/ape-program-20260913`; HEAD de preflight: `0ef6e89c`.
- [CONFLITO] As notas de estado anteriores ainda apontam HEAD `0298f10f` e o próximo trabalho planejado; o código/Git deste worktree é a fonte atual para esta task. A reconciliação do HEAD final será feita após o commit.

## Decisão vigente

- [DECISÃO VIGENTE] A orientação do deck é uma projeção de sessão, sem alterar identidade `term`/`translation`, sem escrita em banco e sem migration.
- [DECISÃO VIGENTE] `resolveEffectiveListSettings(listRow, folderRow)` é a única fonte de settings de lista no `MixedStudy`, incluindo `tts_enabled`; coleções de sistema não herdam idioma da pasta.
- [DECISÃO VIGENTE] A inversão só ocorre com pelo menos 8 pares classificados com confiança alta e consenso mínimo de 80%; textos curtos, sem letras, médios/baixos ou ambíguos não contribuem.

## Evidência e implementação

- [VERIFIED-TEST] RED inicial: o teste de orientação não encontrava os módulos novos; após o esqueleto, a integração de `MixedStudy` era a única falha restante (8/9 passavam). O ajuste de expectativa do score revelou o valor literal 11 do detector herdado; GREEN focado atual: 10/10.
- [VERIFIED-REPO] `src/lib/languageClassifier.ts` concentra padrões pt/en/fr/es/de/it, pesos caractere `+3`, palavra `+2` e limiares high/medium da auditoria; runtime e Edge Function reutilizam o módulo puro.
- [VERIFIED-REPO] `src/features/study/lib/resolveDeckOrientation.ts` agrega apenas pares high-confidence e retorna idiomas efetivos, flag `inverted` e evidência resumida.
- [VERIFIED-REPO] `Study.tsx` e `MixedStudy.tsx` aplicam idiomas/labels efetivos às views; MC, Write e Unscramble recebem labels e `ttsEnabled`. O TTS continua recebendo explicitamente o locale derivado do lado exibido.
- [VERIFIED-TEST] O mock de `speechSynthesis` validou texto inglês com `en-US` e texto português com `pt-BR`.
- [VERIFIED-GATE] Typecheck, suíte anterior ao último teste adicional, lint, build/SEO e brain-check foram executados; os comandos finais serão repetidos após o fechamento do diff.

## Handoff e limites

- [FOLLOW-UP] `gameCore.ts` mantém resolver duplicado; wrappers MC/Write/Unscramble ainda recalculam direção; `PronunciationStudyView` ainda fala sempre `sideB`. Não expandir este lote para esses caminhos.
- [RISCO RESIDUAL] Não houve browser/voz real nesta task; a garantia atual é de contrato, unidade e compilação. A heurística continua conservadora e não é tradução geral.
## Fix round 1 (supervisor, após revisão independente)

- [CORRIGIDO — HIGH] O critério original exigia confiança `high` do classificador **nos dois lados de
  cada card**. Medido no deck real (`a1c6d475…`, 14 cards): term votava português em **14/14**, mas com
  `confidence` `medium`/`low`; com isso o deck tinha **0 pares válidos**, não atingia o mínimo de 8 e
  `inverted` ficava `false` — ou seja, o bug do print continuava na tela.
- [DECISÃO] A decisão passou a ser por **voto agregado**: o card vota quando o classificador devolve
  idioma (texto ambíguo/curto devolve `null` e NÃO vota), com mínimo de 8 cards votando dos dois lados,
  mínimo de 8 cards invertidos e razão ≥ 80%. Continua proibido inverter por 1 card ou por frase curta.
- [VERIFIED-TEST] Fixture PERMANENTE com os 14 cards reais da lista em
  `src/features/study/lib/resolveDeckOrientation.realDeck.test.ts`: term pt 14/14, translation en 12/14,
  `inverted = true`. "No.", "OK.", "Hotel.", "Pizza." continuam retornando `null` (não votam).
- [CORRIGIDO — MEDIUM] `ttsEnabled` não chegava ao modo Pronúncia: a lista com TTS desligado seguia
  falando. Agora `Study.tsx` repassa e a view honra (handler, `speakOnHintClick` e botão desabilitado),
  coberto por `pronunciationTts.contract.test.ts`.
- [LIÇÃO DURÁVEL] Portão de confiança **por item** mata sinal em frases curtas e reais; o limiar deve ser
  **agregado**, e o teste precisa usar uma amostra REAL do acervo — fixture sintética não pega esse erro.
  O repositório não tem ambiente DOM de teste (sem jsdom/testing-library): contrato de view é por leitura
  de fonte + lógica pura testada.
