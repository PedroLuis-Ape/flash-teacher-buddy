# 🛡️ Função "Inverter conteúdo dos cards" — PROTEGIDA

> **NÃO REIMPLEMENTAR NO FRONTEND.**
> **NÃO TROCAR POR LOOP CARD-A-CARD.**
> **NÃO MISTURAR COM INVERSÃO DE IDIOMA / RÓTULOS.**

## O que é

Função acionada pelo botão **"Inverter conteúdo"** dentro de `ListDetail`.
Troca, para todos os cards de uma lista, o campo `term` ↔ `translation`
em uma **única transação no servidor** via a RPC Supabase
`swap_flashcards_sides`.

## O que ela **NÃO** faz

Ela **nunca** toca em nenhuma destas configurações:

- `lang_a`, `lang_b`
- `labels_a`, `labels_b`
- `study_type`
- `tts_enabled`

Por isso, depois de uma inversão **não pode** acontecer "inglês no campo de
português" ou vice-versa por causa da troca: as labels/idiomas continuam
exatamente como estavam.

Para inverter rótulos/idiomas existe outra RPC separada (`swap_list_sides`).
As duas operações são independentes e **não devem** ser combinadas.

## Contrato de implementação

Local único: `src/pages/ListDetail.tsx → handleSwapSides`.

Regras imutáveis:

1. Uma única chamada `supabase.rpc("swap_flashcards_sides", { _list_id })`.
2. Sem loop client-side. Sem `update` individual por card.
3. Sem mexer em colunas de `lists` ou `folders`.
4. Após sucesso, invalidar **apenas**:
   - `["flashcards", id]`
   - `["gameshub-list", id]`
   - `["study-flashcards", id]`
5. Remover a cópia offline da lista (`removeOfflineList(id)`) para evitar
   conteúdo desatualizado.
6. Guard `if (isSwapping) return` evita execuções concorrentes.

## Proteção contra regressão

Existe um teste de contrato em
`src/pages/__tests__/swapFlashcardsSides.contract.test.ts` que valida:

- term/translation invertidos por card
- ordem dos cards preservada
- IDs dos cards preservados
- configurações da lista intactas
- duas inversões consecutivas restauram o estado original
- a chamada é uma só (sem loop por card)
- as três chaves de cache corretas são invalidadas

Se você for **modificar** essa função no futuro:

- Rode os testes (`bunx vitest run`).
- Não remova o teste de contrato.
- Se precisar mudar o contrato, atualize **este documento** e o teste
  no mesmo PR — nunca silenciosamente.

## Por que essa função é "frágil" historicamente

Já foi quebrada por:

- Tentativa de fazer loop client-side (travava o mobile e atualizava
  a lista pela metade quando a conexão caía).
- Mistura com a inversão de `lang_a/lang_b` / labels (causava o bug
  "português apareceu no campo de inglês").
- Esquecer de invalidar a cópia offline (mostrava conteúdo antigo
  no modo de estudo).

Por isso ela hoje é uma única RPC atômica + invalidações específicas.
Mantenha assim.