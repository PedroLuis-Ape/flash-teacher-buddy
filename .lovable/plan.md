

## Plano: Corrigir glossário quebrado + adicionar inversão de termos no glossário

### Problema identificado

Dois problemas distintos:

**1. Glossário não aparece no estudo após importação**
- Na `BulkImportDialog.tsx` (linha 108), todas as entradas de glossário são inseridas com `side: "A"` hardcoded
- A lógica de `mergeGlossaryAndManual` em `glossaryMerge.ts` faz matching bidirecional: quando renderiza o lado A do card, procura `g.original_text` nas entradas com `side="A"`
- Se o conteúdo importado no `original_text` do glossário está no idioma B (ex: português) mas `side="A"`, o match falha porque o texto do termo (lado A) está em francês e o `original_text` do glossário está em português
- **Causa raiz**: o toggle "Trocar conteúdo entre lados" inverte os cards mas NÃO inverte o glossário — as palavras do glossário ficam no lado errado

**2. Não existe função de inverter termos no glossário**
- O `ListGlossaryManager` não tem botão para trocar `original_text ↔ translated_text` nas entradas existentes
- Quando o usuário importa com a direção errada, não tem como corrigir sem deletar e reimportar

### Mudanças planejadas

**Arquivo 1: `src/components/BulkImportDialog.tsx`**
- Aplicar `invertAB` também ao glossário durante importação: quando ativo, trocar `original_text ↔ translated_text` nas entradas de glossário (mantendo `side: "A"`)
- No preview do glossário, mostrar labels A/B nos termos (como já feito nos cards)
- Quando `invertAB` ativo, mostrar o preview do glossário com os termos trocados

**Arquivo 2: `src/features/study/components/ListGlossaryManager.tsx`**
- Adicionar botão "Inverter termos" (ícone `ArrowLeftRight`) na toolbar do glossário (ao lado de "Selecionar")
- Funciona em modo de seleção: seleciona entradas → clica "Inverter selecionados" → troca `original_text ↔ translated_text` nas entradas selecionadas via `updateEntry` em batch
- Também adicionar um botão "Inverter todos" com AlertDialog de confirmação
- Labels A/B continuam fixos — só o conteúdo troca de lado

**Arquivo 3: `src/hooks/useListGlossary.ts`**
- Adicionar mutation `bulkSwapTerms` que recebe array de IDs e faz update trocando `original_text ↔ translated_text` para cada entrada
- Usar uma abordagem eficiente: buscar as entradas atuais, montar os updates com campos trocados, executar em batch

### Resultado esperado
- Glossário importado aparece corretamente no estudo (invertAB afeta glossário também)
- Usuário pode inverter termos do glossário existente sem deletar/reimportar
- Preview de importação mostra claramente qual texto vai para qual lado (A/B) no glossário

