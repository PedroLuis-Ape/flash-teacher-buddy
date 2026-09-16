---
category: documentation
type: area
area: study-runtime
status: active
related:
  - "[[01-CURRENT-STATE]]"
  - "[[04-DECISIONS]]"
  - "[[08-RISKS]]"
  - "[[07-TESTS]]"
---

# Área — Runtime de estudo (settings, TTS, sessões, listas grandes)

Relatório de auditoria versionado:
`reports/study-runtime/2026-09-14-study-runtime-audit.json`.

## Arquitetura final das configurações

- **BASE PREFERENCE** (persistida em `user_study_preferences` /
  `user_list_study_preferences`): `direction`, `order`, `scope`, `fastMode`,
  `studyFlowMode`, `playTarget`, `writeActivityMode`, `writeRewriteSide`,
  `writeRewritePromptMode`, `writeCorrectionMode`.
- **TEMPORARY CONSTRAINT** (nunca persiste como preferência): Foco Vermelho e
  `mastery_rounds` forçando `effectiveDirection = "any"`; saída restaura a base
  via `releaseRedFocusConstraints` / `releaseMasteryRoundsConstraints`.
- **DERIVED STATE**: `resolveEffectiveStudyDirection`, `resolveStudySides`,
  `playModeEffective`/`playFixedSide` no Flip, rótulos A/B em
  `playPresetRuntime` (somente labels, não comportamento).
- **EPHEMERAL CARD STATE**: flip atual, feedback, autoplay em curso.
- **LEGACY WIRE / MIGRATION**: `playMode`/`playSide` existem apenas em
  `legacyPlayToTarget`, na leitura de linhas antigas do repositório de
  preferências e no envelope v1 de `studySessionContext`. Nunca no runtime.

### Reescrever x "Escrever o que ouviu" (2026-09-15)

- `writeActivityMode` mantém DOIS valores (`translate` | `rewrite`); qual
  experiência de reescrita roda é decidido por `writeRewritePromptMode`
  (`visible` | `listening`). Ditado NÃO é fase obrigatória da reescrita.
- `visible` (reescrita visual, default): a frase-alvo é montada desde o início,
  sem fase LISTENING, áudio manual opcional e correção exata.
- `listening` (ditado): mantém TTS, velocidade, hints graduais e reveal, também
  com correção exata.
- Estado inicial por modalidade: `createRewriteFlowState("visible")` nasce em
  `REWRITE`; `createRewriteFlowState("listening")` (default legado) nasce em
  `LISTENING`.
- Snapshots próprios por modalidade (`buildRewriteCardIdentity`); o formato
  legado (`buildLegacyRewriteCardIdentity`) é lido apenas em `listening`.
- Migration `20260915190000_write_rewrite_prompt_mode.sql` (aditiva, default
  'visible') aplicada em `ymahldldyxvwjeruaxpr`.

## Compatibilidade de sessões antigas (P0 desta rodada)

A chave v1 era o JSON do envelope inteiro e embutia o par físico do Play, que
podia variar por usuário (`both` com `playSide` `a` **ou** `b`). Um único
mapeamento semântico V3 → wire v1 não reproduzia a chave de todos.
`buildLegacyStudySessionScopeKeyCandidates` gera todas as variantes plausíveis
(semântica, both+a, both+b, single+a, single+b e envelope pré-Play) e a leitura
aceita a primeira existente — snapshots de estudo e progresso do Flip em
`useStudyEngine`. A escrita continua exclusivamente moderna.

## TTS / Play event-driven

`useTTS` é o owner único: promessa por request, geração/token (`sessionRef`),
resolução em `onstart`/`onend`/`onerror`, cancelamento com `reason`. O autoplay
do Flip encadeia `speak → onend real → pausa curta de UI → próximo passo`; não
existe mais relógio fixo de 7 s. `AUTO_PLAY_FAILSAFE_MS` só protege contra
promessa pendente; `AUTO_PLAY_SILENT_READ_MS` só vale quando não há fala.

## Listas grandes (ListDetail)

Primeira página real (200 cards) em query própria para paint rápido; o conjunto
completo continua sendo carregado porque busca, camadas, seleção, bulk actions e
exportação prometem a lista inteira. Enquanto o conjunto completo carrega,
"selecionar todos" é bloqueado com aviso honesto em vez de operar em conjunto
parcial. A busca ainda é client-side e a interface informa que a lista completa
está carregando; busca/paginação server-side continuam pendentes para eliminar
qualquer falso negativo transitório em listas muito grandes.

## Dívidas que permanecem

- Paginação **server-side** verdadeira + busca no servidor em ListDetail não foi
  feita; a solução atual é progressive load com semântica explícita.
- `src/styles/space-ui-game.css` continua acoplado a classes Tailwind
  (`.max-w-6xl`, `[class*="border"]`, `!important`); a refatoração do shell
  in-game não foi feita para não alterar identidade visual.
- Smoke visual autenticado (mobile ~390px e desktop ~1366px) não foi executado
  neste ambiente; nenhuma afirmação visual foi declarada como validada.
