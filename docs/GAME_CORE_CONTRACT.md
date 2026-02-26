# Game Core — Contrato da Lógica do Jogo

**Arquivo protegido:** `src/features/study/lib/gameCore.ts`  
**Testes:** `src/features/study/lib/gameCore.test.ts`

## ⚠️ Regra de Proteção

Este módulo contém a lógica pura do jogo. Não modifique sem:
1. Rodar os testes existentes
2. Atualizar os testes para refletir a mudança
3. Documentar a razão da alteração neste arquivo

## Entradas / Saídas

### `resolveStudySides(sideA, sideB, direction, cardSeed)`
- **Entrada:** dois objetos StudySide, direção ("pt-en"|"en-pt"|"any"), seed do card
- **Saída:** `{ promptSide, answerSide, isAFirst }`
- **Comportamento:** Decide qual lado é pergunta e qual é resposta

### `resolveDirection(baseDirection, isSwapped, cardIndex)`
- **Entrada:** direção base, flag de swap, índice do card
- **Saída:** "pt-en" | "en-pt" (nunca "any")
- **Comportamento:** Resolve "any" por índice, aplica swap

### `shuffleArray(array)`
- **Entrada:** array readonly
- **Saída:** novo array embaralhado
- **Invariante:** nunca muta o original

### `computeStats(results)`
- **Entrada:** array de StudyResult
- **Saída:** `{ correctCount, errorCount, skippedCount, totalAnswered, accuracy }`

### `generateNextRound(missedIds, unseenIds, batchSize)`
- **Entrada:** IDs dos cards errados, IDs não vistos, tamanho do batch
- **Saída:** `{ roundCards, remainingUnseen }`
- **Algoritmo:** Priority A (errados) + Priority B (não vistos)

### `generateMultipleChoiceOptions(correctAnswer, allAnswers, numDistractors)`
- **Entrada:** resposta correta, todas as respostas possíveis, número de distratores
- **Saída:** `{ options, correctIndex }`

### `recordResultImmutable(results, flashcardId, correct, skipped)`
- **Entrada:** resultados atuais, ID do card, acerto/erro, pulou
- **Saída:** novo array de resultados (nunca muta o original)

### `getMixedMode(cardIndex)`
- **Entrada:** índice do card
- **Saída:** "flip" | "write" | "multiple-choice" | "unscramble"
- **Ciclo:** flip → write → multiple-choice → unscramble → flip ...

## Estados Possíveis

| Estado | Descrição |
|--------|-----------|
| `not_started` | Session criada mas nenhum card respondido |
| `in_progress` | Cards sendo respondidos |
| `round_complete` | Todos os cards da rodada atual respondidos |
| `game_complete` | Todos os cards vistos E acertados (unseen=0, missed=0) |
| `finished` | Sessão explicitamente concluída pelo usuário |

## Invariantes

1. **Imutabilidade de dados**: Nenhuma função do gameCore muta os objetos de entrada
2. **Swap é visual**: `applySwap`/`resolveDirection` alteram apenas a direção, nunca os campos term/translation
3. **Determinismo de "any"**: Mesmo seed = mesmo lado (hashToBool é estável)
4. **Embaralhamento seguro**: `shuffleArray` sempre retorna nova instância
5. **Idempotência de resultado**: `recordResultImmutable` pode ser chamado múltiplas vezes para o mesmo card

## Como Rodar os Testes

```bash
npx vitest run src/features/study/lib/gameCore.test.ts
```

Se algum teste falhar, a invariante correspondente foi violada.
