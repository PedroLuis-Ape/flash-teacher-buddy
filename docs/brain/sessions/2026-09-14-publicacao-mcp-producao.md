---
cssclasses:
  - ape-ai-note
type: session-checkpoint
status: active
date: 2026-09-14
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[08-RISKS]]"
  - "[[areas/mcp-reference-ids-and-importers]]"
  - "[[areas/mcp-agent-api]]"
---

# Publicação do MCP em produção — 2026-09-14

## Onde fica a produção (evidência)

- [FATO CONFIRMADO] O endpoint MCP é `https://ymahldldyxvwjeruaxpr.supabase.co/functions/v1/mcp` e existe: responde `401 {"error":"unauthorized"}` sem credencial, então exige OAuth.
- [FATO CONFIRMADO] A Lovable gerencia o projeto **`ymahldldyxvwjeruaxpr`**: o banco acessível pelo SQL da Lovable tem 44 pastas, 145 listas e 6.023 cards e o lineage de funções do repositório. O outro projeto visível no conector Supabase, `xrnfhhoxmmstagmelvyi`, tem **0 pastas, 0 listas, 0 cards** — não é o banco da aplicação.
- [FATO CONFIRMADO] `supabase/config.toml` aponta para `xrnfhhoxmmstagmelvyi`, enquanto `.env.example` e `platformRuntime.ts` usam `ymahldldyxvwjeruaxpr` como `PRODUCTION_DATA_PROJECT_ID`. Ao mexer em deploy/migration, o alvo é o segundo.

## Migrations aplicadas em produção (ymah)

- [FATO CONFIRMADO] `20260914133000_import_capabilities_glossary.sql` aplicada: `get_import_capabilities_v2()` existe.
- [FATO CONFIRMADO] `20260914130000_piteco_reference_ids.sql` aplicada: `reference_id` presente em `folders` e `lists`, backfill sem nulos (0/0), 2 índices únicos e 2 triggers de imutabilidade; o guard `trg_*_system_collection_readonly` voltou habilitado.
- [FATO CONFIRMADO] `20260914132000_lists_with_card_counts_reference_id.sql` aplicada: o RPC devolve `reference_id text`.

## Defeito concreto encontrado e corrigido

- [FATO CONFIRMADO] A primeira tentativa da migration de reference ids falhou em produção com `42501: Coleção automática é somente leitura`, vinda do guard `prevent_system_collection_mutation()`: o backfill atualiza linhas com `system_kind <> 'user'`. A transação abortou e nada foi aplicado.
- [DECISÃO VIGENTE] O guard sanciona a escotilha `current_user = 'postgres'` **e** `app.allow_system_collection_mutation = 'on'`. A migration agora usa `set_config(..., true)` (transaction-local) antes do backfill e volta para `off` depois. A correção foi validada em produção e o guard segue ativo.

## Bloqueio do deploy (Edge Function)

- [FATO CONFIRMADO] O conector Supabase **não tem acesso** ao projeto `ymahldldyxvwjeruaxpr`: `list_projects` mostra apenas `xrnfhhoxmmstagmelvyi` e `rnriudxxafcnftjiysue`, e qualquer chamada ao projeto do MCP responde `You do not have permission to perform this action`. O rótulo do schema também exige exatamente `app.allow_system_collection_mutation`, não uma variação.
- [FATO CONFIRMADO] Não existe caminho alternativo no ambiente: CLI `supabase` não instalada, nenhum token em variável de ambiente e nenhum workflow do GitHub faz deploy de function (`rg 'functions deploy' .github/workflows` vazio).
- [PENDENTE] Deploy do bundle atual (29 tools) para `mcp` em `ymahldldyxvwjeruaxpr` e `tools/list` autenticado. Requer que o projeto ymah seja liberado no conector ou que o deploy seja feito com credencial própria.

## Lacunas descobertas na produção (não são bugs de código)

- [FATO CONFIRMADO] `import_folder_glossary_v2(uuid,jsonb,text,boolean)` **não existe** em produção; existe `import_folder_glossary_v1(_folder_id,_entries,_mode,_dry_run)`. A migration `20260712194500_folder_glossary_scale_v2.sql` (no main) nunca foi aplicada em produção. Efeito: `execute_glossary_import` responde `unavailable` em vez de gravar.
- [FATO CONFIRMADO] `folders.emoji` também não existe em produção — a personalização de emoji fica só no dispositivo até aplicar `20260914010000_folder_emoji.sql`.
- [DECISAO VIGENTE] Não aplicar a migration de glossário v2 nesta rodada: é subsistema amplo (substitui v1) e com impacto na aplicação publicada; fica como item explícito para decisão.

Related: [[00-HOME]] · [[01-CURRENT-STATE]] · [[08-RISKS]] · [[areas/mcp-reference-ids-and-importers]]
