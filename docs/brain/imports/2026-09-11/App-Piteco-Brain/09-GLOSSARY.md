---
cssclasses:
  - ape-ai-note
---

# Glossary

## Arquitetura
**[DECISÃO]**
A) significado base/global  
B) significado contextual por card (`word_hints`)  
C) expressão/chunk/phrasal verb.

Não achatar tudo numa tradução única.

## Runtime
**[VERIFICADO-REPO]**

### `glossaryIndex.ts`
Índice por token/formas de expressão. É descoberta lexical de candidatos, não semantic resolver completo.

### `glossaryLayers.ts`
Suporta:
- palavra inteira e expressão;
- whitespace flexível;
- apóstrofos/hífens Unicode;
- hints indexados;
- scope contextual;
- segmentos descontínuos;
- overlaps;
- palavra + expressão no mesmo popover;
- prioridade contextual.

### `wordHints.ts`
`WordHint` pode ter:
- text/translation/note;
- startIndex/endIndex;
- side A/B;
- global/contextual;
- word/expression;
- occurrence;
- segments descontínuos.

Há fallback regex legado.

## Sync atual
**[VERIFICADO-REPO]**
`folderGlossarySyncApi.ts`:
- só promove `word_hints` se `scope === "global"`;
- preserva hints contextuais no card;
- opcionalmente promove cards normais;
- deduplica por side+term;
- traduções adicionais viram alternativas.

## Semântica
Exemplos desejados:
- `I worked out yesterday.` → malhar
- `The plan worked out.` → dar certo
- `Can you work it out?` → resolver.

`workout` ≠ `work out`.

## Performance
Não chamar LLM durante clique/gameplay.
Enriquecer em criação/import/sync/review e persistir.

## UI
Prioridade desejada:
1. Neste contexto
2. expressão
3. palavra/base
4. alternativas.

## Histórico
- Jun/2026 PR #58: layers + import/export lossless.
- Jul/2026 PR #305: interação, Unicode, palavra+expressão.
- Set/2026: `wip(glossary): preserve contextual hints and semantic evidence`.

## Glossário de turma
**[HISTÓRICO/REVALIDAR]**
Foi planejado como domínio isolado do glossário de pasta, compartilhando núcleo/UI. O admin DB atual não mostrou `class_glossary`; confirmar implementação real antes de assumir que o plano foi concluído.
