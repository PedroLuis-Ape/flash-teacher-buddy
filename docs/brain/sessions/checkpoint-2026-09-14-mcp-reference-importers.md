---
cssclasses:
  - ape-ai-note
type: session-checkpoint
status: in-review
date: 2026-09-14
related:
  - "[[areas/mcp-reference-ids-and-importers]]"
  - "[[areas/mcp-agent-api]]"
  - "[[01-CURRENT-STATE]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[learning/00-LEARNING-HUB]]"
---

# Checkpoint — MCP Reference IDs e importadores oficiais

## Estado exato para retomada

- [FATO CONFIRMADO] A implementação está no worktree
  `C:\Users\pedro\Documents\App-Piteco-Worktrees\mcp-reference-importers-20260914`,
  branch `feat/mcp-reference-importers`, partindo de
  `d8984160d1770aa561238b547c69c388020b1e35`.
- [FATO CONFIRMADO] Não houve commit, push, merge, aplicação de migration,
  deploy ou publicação. O checkout principal `C:\Users\pedro\Documents\APP
  PITECO` não foi alterado por esta etapa.
- [FATO CONFIRMADO] Source/manifesto chegaram a 29 tools. Foram adicionados
  mapa de capacidades, preview/execute de conteúdo e preview/execute de
  glossário, além de UUID + `F-XXXXXX`/`L-XXXXXX` para pastas/listas.
- [FATO CONFIRMADO] A migration nova é
  `supabase/migrations/20260914130000_piteco_reference_ids.sql` e ainda está
  pendente no Supabase.

## Gates já executados

- [FATO CONFIRMADO] Testes focados: 24 arquivos / 146 testes PASS quando a
  UI de referência foi incluída; MCP isolado: 23 arquivos / 145 testes PASS.
- [FATO CONFIRMADO] `npm run typecheck`, `npm run lint -- --quiet`,
  `npm run check:security` e `npm run build` passaram; build/SEO marcou
  100/100. O check de segurança produziu 0 erros e 26 avisos preexistentes.
- [FATO CONFIRMADO] `npm run brain:check` passou antes deste checkpoint.
- [CONFLITO RESOLVIDO] O bundle foi válido imediatamente após
  `npm run mcp:bundle`, mas o `npm run build` seguinte reescreveu
  `supabase/functions/mcp/index.ts` com o wrapper Windows `npm:C:\...`.
  Portanto o estado atual do arquivo gerado é stale/inválido até regenerar
  novamente.

## Revisão cruzada pendente de correção

- [FATO CONFIRMADO] Clara Revisão encerrou com `STATUS: FAIL`; não editou
  arquivos. O achado HIGH do bundle foi confirmado no estado atual após o
  build e precisa ser corrigido primeiro.
- [PENDENTE] M1: preview deve rejeitar `card_conflict=replace` quando há
  grupos em camadas, como o RPC oficial já rejeita.
- [PENDENTE] M2: documentar/alinha o catálogo de listas ao contrato do RPC
  oficial, que exige `lists.owner_id`; investigar legado antes de permitir
  criação automática que possa duplicar nomes.
- [PENDENTE] M3: resolução automática por nome duplicado deve retornar
  `ambiguous` e exigir `destination_plan`/referência explícita.
- [PENDENTE] M4: incluir `reference_id` no RPC `get_lists_with_card_counts`
  usado por `Folder.tsx`, com migration e tipos/teste.
- [PENDENTE] M5: capability RPC atual não devolve status do
  `import_folder_glossary_v2`; alinhar o contrato ou registrar explicitamente
  essa capacidade sem inferência silenciosa.
- [NAO VERIFICADO] Ainda faltam smoke autenticado real, RLS real, runtime Deno
  e retry real com dados pequenos.

## Próximas ações obrigatórias

1. Regerar o bundle com `npm run mcp:bundle` **depois** do build e confirmar
   `npm run mcp:bundle:check`, além de ausência de `npm:C:` e `npm:@/...`.
2. Corrigir M1, M3 e M4; resolver M2/M5 com evidência do contrato e testes
   antes de afirmar prontidão.
3. Rodar novamente typecheck, MCP tests, lint, build, bundle check e
   brain-check. O build deve ser o gate da aplicação; a regeneração do bundle
   é o último passo do artefato MCP.
4. Fazer nova revisão cruzada independente, registrar resultado e só então
   decidir commit/PR. Não fazer deploy, merge ou migration automaticamente.
5. Depois de revisão humana e aplicação controlada da migration, executar o
   smoke MCP de 3–5 cards/glossário descrito em
   [[areas/mcp-reference-ids-and-importers]].

## Nota para o próximo agente

Comece lendo [[areas/mcp-reference-ids-and-importers]] e esta nota; não releia
o vault inteiro. O checkpoint prevalece sobre qualquer afirmação anterior de
bundle pronto. Preserve o worktree e não use o checkout principal para editar.

Related: [[areas/mcp-reference-ids-and-importers]] · [[areas/mcp-agent-api]] · [[08-RISKS]]

---

## Atualização — 2026-09-14 (mesma rodada, após o checkpoint acima)

O texto anterior é histórico desta rodada; ele descreve o estado ANTES da
correção dos achados M1–M5. O estado vigente é o abaixo.

- [FATO CONFIRMADO] M1 resolvido: preview e execute recusam
  `card_conflict = 'replace'` com pacote em camadas
  (`E_LAYERED_REPLACE_UNSUPPORTED`), sem chamar o gateway.
- [FATO CONFIRMADO] M2 resolvido: o catálogo de destino do importador espelha o
  contrato do RPC oficial (`folders.owner_id`/`lists.owner_id`, `system_kind`,
  sem turma, sem lixeira) e o catálogo passou a selecionar `reference_id`.
  A autoridade de leitura por pasta não é mais misturada com a de destino.
- [FATO CONFIRMADO] M3 resolvido: o plano default responde `ambiguous` quando
  dois destinos existentes compartilham o nome, exigindo seleção explícita.
- [FATO CONFIRMADO] M4 resolvido: `20260914132000_lists_with_card_counts_reference_id.sql`
  devolve `reference_id` no RPC usado por `Folder.tsx`, com tipos e teste.
- [FATO CONFIRMADO] M5 resolvido: `20260914133000_import_capabilities_glossary.sql`
  publica `get_import_capabilities_v2` com o diagnóstico real do glossário v2;
  a v1 permanece como fallback honesto e payload sem `capabilities` não é
  aceito como resposta.
- [FATO CONFIRMADO] Bundle regenerado após o build: `BUNDLE_CHECK_PASS` com 29
  tools e sem `npm:C:`/`npm:@/`. A regra de ordem é build → mcp:bundle → check.
- [FATO CONFIRMADO] Gates desta rodada: MCP `154/154`, suíte `1992` testes
  passando, `tsc` exit 0 nos dois projetos, `eslint` exit 0 (0 erros), build
  exit 0 com SEO `100/100`, `brain-check` PASS.
- [FATO CONFIRMADO] Revisão cruzada independente (Luna High) executada e
  ingerida: `FAIL` na primeira rodada, com 1 HIGH (bundle lido no meio do
  `vite build` — falso positivo revalidado depois) e 4 MEDIUM. Dois MEDIUM
  eram reais e foram corrigidos com teste: caixa da referência aceita mas não
  resolvida, e escopo/idiomas do catálogo de destino. Os outros dois são
  preexistentes na UI e ficaram em [[08-RISKS]] como R-2026-09-14-02.
- [VERIFIED-TEST] Depois das correções: MCP `158/158`, suíte `1996` testes,
  `tsc` exit 0, `eslint` 0 erros, build exit 0 com SEO `100/100`,
  `BUNDLE_CHECK_PASS tools=29` (8009 linhas, zero `npm:C:`) e `BRAIN_CHECK_PASS`.
- [PENDENTE] Smoke autenticado real do MCP. Nada foi commitado, mergeado,
  publicado nem aplicado no Supabase.
- [CRÍTICO] A publicação depende das três migrations: sem
  `folders.reference_id`/`lists.reference_id` a biblioteca não carrega.

Related: [[areas/mcp-reference-ids-and-importers]] · [[07-TESTS]] · [[08-RISKS]]
