# Relatório — bug A/B + labels + TTS no estudo

## Goal

Corrigir a coerência entre texto exibido, lado A/B efetivo, label, instrução e locale do TTS em `Study` e `MixedStudy`, inclusive para decks legados cuja metadata contradiz o conteúdo. A correção é somente de runtime: não altera cards, não escreve no banco, não executa migration e não publica.

## Causa-raiz

- [FATO CONFIRMADO] `Study.tsx` já consumia `resolveEffectiveListSettings`, mas as views recebiam idiomas/labels derivados da metadata da lista. No deck legado, `lang_a=en`/`lang_b=pt` contradiz `term` em português e `translation` em inglês.
- [FATO CONFIRMADO] `MixedStudy.tsx` tinha um segundo caminho manual para `langA`, `langB`, `labelA` e `labelB`; não carregava `tts_enabled`, ignorava `system_kind` no carregamento e não passava labels ao `sharedProps`.
- [FATO CONFIRMADO] MC, Write, Unscramble e demais fluxos escolhem prompt/resposta pelo lado resolvido, mas o label e o TTS ficavam amarrados aos idiomas de metadata que podia estar invertida. O resultado era texto inglês rotulado como Português, instrução/opções incoerentes e voz errada.

## Desenho aplicado

1. [DECISÃO VIGENTE] `MixedStudy` agora seleciona `study_type`, `lang_a`, `lang_b`, `labels_a`, `labels_b`, `tts_enabled` e `system_kind`, e chama exclusivamente `resolveEffectiveListSettings(listRow, folderRow)`. A regra existente de coleções `reinforcement`/`attention_points` continua impedindo herança indevida da pasta.
2. [DECISÃO VIGENTE] `src/lib/languageClassifier.ts` concentra a heurística pura extraída da Edge Function: padrões pt/en/fr/es/de/it, caractere `+3`, palavra `+2`, `high` em score `>=6` e `>2x` o segundo, `medium` em score `>=3` e acima do segundo. Textos com menos de 3 caracteres, sem letras ou sem score retornam sem evidência; confiança medium/low não entra na inversão.
3. [DECISÃO VIGENTE] `resolveDeckOrientation` agrega somente pares em alta confiança, exige pelo menos 8 pares e pelo menos 80% apontando simultaneamente A→metadata B e B→metadata A. Quando forte, retorna idiomas efetivos trocados, `inverted: true` e evidência; caso contrário preserva metadata.
4. [DECISÃO VIGENTE] `Study.tsx` e `MixedStudy.tsx` usam os idiomas/labels efetivos somente na sessão. `resolveEffectiveSideLabels` troca labels junto com os idiomas quando há inversão; `term` e `translation` continuam no mesmo lado físico.
5. [DECISÃO VIGENTE] MC, Write e Unscramble agora recebem `labelA`, `labelB` e `ttsEnabled`; todos passam ao TTS o locale BCP47 calculado do `promptSide`/`answerSide` efetivo e o texto efetivamente exibido. O áudio fica desabilitado quando `tts_enabled` é falso.
6. [FATO CONFIRMADO] A Edge Function `audit-ab-consistency` reutiliza o classificador puro; não foi introduzido import de Deno no app.

## Evidência RED/GREEN

### RED

- [VERIFIED-TEST] O primeiro teste focado falhou porque `resolveDeckOrientation.ts` ainda não existia; essa falha foi estrutural e esperada no TDD.
- [VERIFIED-TEST] Depois do esqueleto do resolver/classifier, o teste focado registrou `9 tests | 1 failed`: a única falha era o contrato de fonte única ainda não integrado no `MixedStudy`; os demais comportamentos já passavam.
- [VERIFIED-TEST] Ao adicionar a asserção de score literal, houve `10 tests | 1 failed` por expectativa incorreta de `8`; a execução observou score `11`, valor correto da soma herdada. A expectativa foi corrigida e o foco ficou verde.

### GREEN

- [VERIFIED-TEST] Foco final: `10 passed (10)`.
- [VERIFIED-TEST] Suíte final: `278 passed (278)` arquivos e `1723 passed (1723)` testes.
- [VERIFIED-TEST] O teste cobre a-b, b-a, any, deck legado invertido com evidência, frases `No.`, `OK.`, `Hotel.`, `Pizza.` em massa, amostra de 1–2 cards, contrato do resolver no Mixed, coleção de sistema e mock de `speechSynthesis`/`useTTS` com `en-US`/`pt-BR`.

## Gates executados — comandos e saídas observadas

### TypeScript

```text
node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json
```

Saída literal: nenhuma. Exit code: `0`.

### Vitest completo

```text
node node_modules/vitest/vitest.mjs run
```

Saída literal final:

```text
 Test Files  278 passed (278)
      Tests  1723 passed (1723)
   Start at  01:21:02
   Duration  28.50s (transform 9.31s, setup 0ms, import 25.25s, tests 14.97s, environment 85ms)
```

Exit code: `0`.

### ESLint

```text
node node_modules/eslint/bin/eslint.js .
```

Saída literal final:

```text
✖ 72 problems (0 errors, 72 warnings)
  0 errors and 7 warnings potentially fixable with the `--fix` option.
```

Exit code: `0`. Há 72 warnings de hooks/refresh e diretivas já presentes no repositório; não houve erro novo no código desta task. Não foram corrigidos warnings fora do escopo.

### Build + SEO

```text
npm run build
```

Saída literal relevante do gate:

```text
✓ built in 24.41s
Orçamento do bundle aprovado.
APE SEO visibility score: 100/100
- entity_clarity: 20/20
- editorial_depth: 20/20
- discovery: 20/20
- rendered_artifact: 20/20
- privacy_integrity: 20/20
```

Exit code: `0`. Permanecem warnings conhecidos de CSS e chunks grandes; não bloquearam o build.

### Segundo Cérebro

```text
node scripts/brain-check.mjs
```

Saída literal final:

```text
Second Brain: C:\Users\pedro\Documents\App-Piteco-Worktrees\ape-discovery-activation-20260913\docs\brain
Notes: 48; wikilinks: 523; canonical IDs: 1
BRAIN_CHECK_PASS
```

## Arquivos alterados nesta task

- `src/lib/languageClassifier.ts`
- `src/features/study/lib/resolveDeckOrientation.ts`
- `src/features/study/lib/resolveDeckOrientation.test.ts`
- `src/pages/Study.tsx`
- `src/pages/MixedStudy.tsx`
- `src/features/study/components/MultipleChoiceStudyView.impl.tsx`
- `src/features/study/components/WriteStudyView.impl.tsx`
- `src/features/study/components/UnscrambleStudyView.impl.tsx`
- `supabase/functions/audit-ab-consistency/index.ts`
- `docs/brain/06-BUGS.md`
- `docs/brain/07-TESTS.md`
- `docs/brain/08-RISKS.md`
- `docs/brain/sessions/2026-09-13-ab-language-orientation.md`
- `.superpowers/sdd/ab-bug-report.md`

## Follow-ups explicitamente preservados

- [FOLLOW-UP] `gameCore.ts` mantém o resolver duplicado; não foi refatorado neste lote.
- [FOLLOW-UP] Os wrappers `MultipleChoiceStudyView`, `WriteStudyView` e `UnscrambleStudyView` ainda podem recalcular direção; a correção atual garante que, qualquer que seja o lado escolhido, o idioma/label/TTS efetivo seja coerente.
- [FOLLOW-UP] `PronunciationStudyView` ainda fala sempre `sideB`; não foi alterado para não expandir o contrato deste bug.

## Riscos residuais

- [KNOWN-LIMIT] A heurística é evidência conservadora, não tradução nem identificação linguística geral. Decks multilíngues, textos curtos ou pouco amostrados permanecem sem inversão automática por desenho.
- [KNOWN-LIMIT] Não houve QA visual em navegador nem voz real; a garantia de TTS é de unidade com `speechSynthesis` mockado, typecheck, suíte e build.
- [KNOWN-LIMIT] O build altera o arquivo pré-existente `reports/seo-visibility/latest-eval.json`; ele foi deliberadamente excluído do staging. Também ficaram fora `supabase/functions/mcp/index.ts`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` e `tmp/`.
- [DECISÃO VIGENTE] Nenhuma ação de banco, migration, produção, merge, push ou deploy foi executada.

## Commit e status

- [FATO CONFIRMADO] Commit com o assunto solicitado: `fix(study): orientacao efetiva de idioma/label/tts no estudo e no modo misto`. O SHA final é o objeto Git informado no handoff da entrega.
- STATUS: DONE; staging seletivo e commit concluídos, sem blocker de implementação ou gate.
