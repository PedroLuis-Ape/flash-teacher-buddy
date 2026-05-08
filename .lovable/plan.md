## Objetivo

Expandir o sistema de cards para suportar **múltiplas camadas de significado** (mini-baralho interno), preservando 100% do comportamento atual de cards de camada única.

---

## 1. Modelo de dados (incremental, sem quebrar nada)

Adicionar colunas opcionais à tabela `flashcards` (nada é removido):

- `parent_card_id uuid NULL` — referência ao card principal. Se `NULL`, o card é principal (comportamento atual).
- `layer_index int NULL` — ordem da camada (0,1,2…). `NULL` para cards sem camadas.
- `example_text text NULL` — frase de exemplo (lado A).
- `example_translation text NULL` — tradução do exemplo (lado B).
- `context_tag text NULL` — tag opcional ("informal", "phrasal", etc).
- `short_explanation text NULL` — explicação curta opcional.

Índice em `(parent_card_id, layer_index)`.

**Compatibilidade:** cards antigos têm tudo `NULL` → continuam funcionando como hoje. RLS atual já cobre (mesmo `list_id` / `user_id`).

**Convenção:**
- Card principal "agregador": tem `term` (ex: "get") mas pode ter `translation` vazia/resumo. Suas camadas são linhas separadas com `parent_card_id = principal.id`.
- Camadas **não aparecem** em listagens normais — só dentro do principal.

---

## 2. Importação com camadas

Estender `src/lib/bulkImport.ts` (sem remover formato atual):

Novo formato detectado por **indentação ou prefixo**:

```
get
  pegar / conseguir | I got a new phone. | Eu consegui um celular novo.
  entender | I get it. | Eu entendi.
  chegar | I got home late. | Eu cheguei em casa tarde.
```

Ou agrupamento por palavra repetida na coluna A (mesma `term` em linhas consecutivas → vira camadas).

Parser retorna estrutura:
```ts
{ term, layers: [{ translation, example, exampleTranslation, tag? }] }
```

`BulkImportDialog` insere 1 card principal + N camadas (`parent_card_id` apontando ao principal). Tudo numa transação chunked (mantém padrão atual de chunks de 50–100).

UI: toggle "Detectar camadas automaticamente" no diálogo (default ligado se feature flag `layered_cards` ativa).

---

## 3. Mesclar cards prontos

Em `FlashcardList`:

- Modo "seleção múltipla" (checkbox por card — só aparece quando o usuário ativa).
- Botão **"Mesclar em camadas"** quando ≥2 cards selecionados.
- Modal com:
  - Campo "Título do card principal" (sugestão automática: maior substring comum entre os `term`s, fallback = primeiro termo).
  - Lista ordenável das camadas (drag para reordenar).
  - Botão Confirmar.
- Ao confirmar: cria novo card principal, atualiza os selecionados com `parent_card_id` + `layer_index`.

**Desfazer mesclagem:** botão "Separar camadas" no card principal → seta `parent_card_id = NULL`, `layer_index = NULL` em todas as camadas, deleta o principal agregador (se foi criado pela mesclagem) ou mantém (se já era card real).

---

## 4. UI de edição do card principal

Novo componente `LayeredCardEditor`:

- Mostra lista de camadas em accordion.
- Adicionar / remover / reordenar (drag-and-drop com `@dnd-kit` que já existe no projeto, ou setas up/down).
- Cada camada edita: tradução, explicação, exemplo, tradução do exemplo, tag.

Integrado em `EditFlashcardDialog` quando o card tem camadas (ou usuário clica em "Adicionar camada" num card simples → vira principal automaticamente).

---

## 5. Modos de jogo

Princípio: **cada camada é um mini-card independente** durante a sessão.

Em `useStudyEngine` — etapa de "expansão":

```ts
function expandLayers(cards) {
  return cards.flatMap(c =>
    c.layers?.length
      ? c.layers.map((L, i) => ({
          id: `${c.id}::${L.id}`,
          parent_id: c.id,
          layer_index: i,
          term: c.term,
          translation: L.translation,
          example: L.example,
          exampleTranslation: L.exampleTranslation,
          hint: L.short_explanation,
        }))
      : [c]
  );
}
```

Comportamento por modo:

- **Flip / Estudar**: mostra card principal com indicador "Camada 1 de 3" + botão "Próxima camada". Ou pode estudar camada-a-camada como cards normais (preferência do usuário, default = camada-a-camada).
- **Múltipla escolha**: usa `translation` da camada específica como resposta correta; `example` aparece como contexto da pergunta para evitar ambiguidade (ex: "_I ___ home late_ → chegar"). Distratores filtram para não coincidir com outras camadas do mesmo principal.
- **Escrita**: valida contra a tradução da camada específica; mostra exemplo como dica.
- **Conectar palavras (unscramble)**: usa `example` da camada (não a palavra solta).
- **Pronúncia**: usa `example` quando disponível, senão `term`.

---

## 6. Progresso

`flashcard_progress` já tem `flashcard_id`. Camadas são linhas reais em `flashcards`, então **cada camada já registra progresso independente** sem mudança de schema. Apenas garantir que o engine usa `layer.id` (não `parent_id`) ao gravar acertos.

---

## 7. Feature flag

`layered_cards` em `src/lib/featureFlags.ts` — desligada por padrão. Quando off, parser ignora indentação, UI não mostra "Mesclar", engine não expande. Zero risco para usuários atuais.

---

## 8. Arquivos a tocar

**Migration nova:**
- `supabase/migrations/<ts>_layered_cards.sql` — adiciona colunas + índice.

**Novos:**
- `src/features/cards/lib/layeredImport.ts` — parser novo formato.
- `src/features/cards/lib/mergeLayers.ts` — lógica mesclar/desfazer.
- `src/features/cards/components/LayeredCardEditor.tsx`
- `src/features/cards/components/MergeIntoLayersDialog.tsx`
- `src/features/cards/lib/expandLayers.ts` — usado pelo engine.
- testes para parser, merge, expand.

**Editar (extensão pura):**
- `src/lib/bulkImport.ts` — chamar `layeredImport` quando flag ligada.
- `src/components/BulkImportDialog.tsx` — toggle "Detectar camadas".
- `src/features/study/components/FlashcardList.tsx` — modo seleção + botão mesclar.
- `src/components/EditFlashcardDialog.tsx` — slot para `LayeredCardEditor`.
- `src/features/study/hooks/useStudyEngine.ts` — chamar `expandLayers` no início.
- `src/features/study/components/{MultipleChoiceStudyView,WriteStudyView,UnscrambleStudyView,FlipStudyView}.tsx` — usar `example` quando presente.
- `src/lib/featureFlags.ts` — `layered_cards`.

**Não tocados:** auth, RLS existentes, rotas, turmas, store, economia, metas, idioma, tema, performance.

---

## 9. Entrega faseada

1. Migration + flag + tipos.
2. Parser de importação + diálogo (Funcionamento 1).
3. `expandLayers` no engine + ajustes mínimos por modo.
4. `LayeredCardEditor` + edição.
5. Mesclar/desfazer (Funcionamento 2).
6. Polimento visual seguindo design premium atual.

Posso começar pela Fase 1 assim que aprovado.