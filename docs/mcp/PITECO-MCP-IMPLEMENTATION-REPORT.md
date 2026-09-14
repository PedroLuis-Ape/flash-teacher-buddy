# PITECO MCP — Implementation Report

Projeto: App Piteco / APE Education · Data: 2026-09-13
Repositório: `https://github.com/PedroLuis-Ape/flash-teacher-buddy.git`
Branch: `integration/ape-program-20260913` · Worktree: `ape-discovery-activation-20260913`
Base: `origin/main` = `8680e4a8` · Commits: `08bd0be5`, `9eeef10b`, `bcd91839` + rodada FASE 5–7

---

## 1. Objetivo

Transformar o MCP do Piteco na **camada operacional do app para agentes**: descobrir, entender,
comparar, decidir, criar, editar, organizar e validar conteúdo da biblioteca da conta autenticada —
sem SQL manual, sem IDs colados pelo usuário e sem abrir pasta por pasta — sempre dentro das
permissões reais (token + RLS).

## 2. Arquitetura

| Camada | Onde | Papel |
| --- | --- | --- |
| Registro MCP | `src/lib/mcp/index.ts` | `defineMcp` (`ape-piteco-mcp`, v0.3.0) + `instructions` + 24 tools |
| Domínio | `src/lib/mcp/domain/*` | Única camada que fala com o Supabase (client scoped ao token, query, scope, access, folders, lists, flashcards, profile, search, validation, confirmation, folderWrites, listWrites, cardWrites, studyMaterialWrites, trash, audit, inventoryInvalidation) |
| Tools | `src/lib/mcp/tools/*` | Uma tool por arquivo: `defineTool` + Zod estrito + annotations |
| Motor linguístico | `src/lib/mcp/learning/*` | Normalização, lemas, idioma, inventário compacto (fingerprint + cache) e análise de texto |
| Servidor | `supabase/functions/mcp/index.ts` | **Artefato gerado** pelo plugin Vite — nunca editar/commitar a versão do Windows |
| Catálogo | `.lovable/mcp/manifest.json` · `docs/mcp/PITECO-MCP-TOOLS.json` | Snapshot oficial das 24 tools (regenerado por `lovable-mcp-extract-manifest`) |

## 3. Modelo de segurança (invariantes)

- Identidade **sempre** de `ctx.getUserId()` / `ctx.getToken()`; nenhuma tool aceita `user_id` do modelo.
- Cliente Supabase com chave anon + Bearer do usuário: **a RLS decide** a autorização final.
- **Service role proibido** no MCP; nenhum endpoint administrativo genérico.
- `system_kind='user'` obrigatório; pastas/listas de sistema são imutáveis (trigger → `42501`).
- Remoção usa **lixeira** (`deleted_at` + `soft_delete_*` / `restore_*`); nunca hard delete.
- Destrutivos em dois passos: **preview + confirmation token stateless**, vinculado a uid, escopo,
  lista e aos **IDs exatos** do alvo, além de um **fingerprint SHA-256** de `id/updated_at/deleted_at`
  — qualquer mutação posterior do alvo (inclusive um restore) invalida o token.
- `analyze_text_against_library` é **read-only** e nunca cria cards sozinha.
- Escritas invalidam o inventário de vocabulário (`inventoryInvalidation`); a chave de cache inclui o
  `institutionId`, evitando colisão entre hubs do mesmo usuário.

## 4. Inventário de tools (24)

**Leitura (7)**: `echo`, `get_my_profile`, `list_folders`, `list_lists`, `get_list`,
`get_flashcards`, `search_my_content`
**Análise (1)**: `analyze_text_against_library`
**Escrita (8)**: `create_folder`, `update_folder`, `create_list`, `update_list`, `move_list`,
`reorder_lists`, `duplicate_list`, `add_flashcards`
**Edição/remoção de cards (2)**: `update_flashcards` (lote via upsert único), `remove_flashcards`
**Destrutivos em dois passos (4)**: `preview_delete_list`, `confirm_delete_list`,
`preview_delete_folder`, `confirm_delete_folder`
**Lixeira (1)**: `restore_from_trash`
**Alto nível (1)**: `create_study_material` (resolve pasta/lista por nome ou id dentro do escopo, cria o
que faltar, insere os cards em **um único batch**, com `dry_run` que não executa nenhuma escrita)

Detalhes, schemas e annotations: `docs/mcp/PITECO-MCP-TOOLS.json`.

## 5. Contratos

- Pasta é a autoridade de escopo; listas legadas nem sempre repetem `owner_id`.
- Escopo `personal | institution`; `institutions` é **owner-only** e membership/roles são de
  **turma** (`turma_membros`). Evolução futura em `assertScopeAccessible`.
- Campos de estudo: `study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled` (+ `primary_side`).
- `move_list` não existia no frontend: é capacidade nova do MCP, validada nos dois lados.
- Remoção de cards cobre as camadas filhas por `parent_card_id` numa única mutação.

## 6. Evidências (números reais)

- `node node_modules/vitest/vitest.mjs run src/lib/mcp` → **19 arquivos / 130 testes PASS** (supervisor).
- `tsc --noEmit -p tsconfig.app.json` → **0 erros**; `tsconfig.node.json` → **0 erros**.
- ESLint do pacote MCP → exit 0.
- `node scripts/brain-check.mjs` → `BRAIN_CHECK_PASS` (63 notas, 735 wikilinks).
- `node scripts/brain-index.mjs --check` → `BRAIN_INDEX_CHECK_PASS` (100 notas).
- Motor de vocabulário (TEST I): 1000 listas / 12.000 cards → **14 requests, 12 páginas, 254 ms**.
- `update_flashcards`: 50 updates → **1 upsert** (antes 50 UPDATEs).
- Replay de token: remover → restaurar → **mesmo token falha**.
- Fingerprint no caminho de **cards**: com um lote material (30 cards ≥ `MAX_REMOVAL_WITHOUT_CONFIRMATION`),
  alterar o estado de um card afetado depois do preview **invalida o token** (teste de regressão em
  `domainWriteCards.test.ts`).
- `npm run build` → **exit 0 com SEO 100/100** (20/20 em entity_clarity, editorial_depth, discovery,
  rendered_artifact e privacy_integrity).
- Lição de harness: o double de teste reutilizava timestamp constante em `updated_at` e **escondia**
  proteções baseadas em estado; corrigido com relógio monotônico
  (`learning/lessons/2026-09-13-fake-sem-updated-at.md`).

### Ciclo de revisão independente

| Rodada | Veredito | Resultado |
| --- | --- | --- |
| 1 | FAIL | 2 HIGH (token sem `card_ids`; cache sem `institutionId`) + 2 MEDIUM (duplicatas no lote; dois UPDATEs na remoção) → **corrigidos** |
| 2 | FAIL | 1 HIGH (token reutilizável após restore) + 2 MEDIUM (audit vazando ID de terceiro; `update_flashcards` N round-trips) + 1 LOW (teste de dry-run fraco) → **corrigidos** |
| 3 (focada) | **PASS** | D1–D4 confirmados por evidência `arquivo:linha`, sem defeito material novo |

## 7. Status das fases

| Fase | Status |
| --- | --- |
| 0 DOMAIN_MAP · 1 Domínio · 2 Read-only · 3 Escrita/lote · 4 Destrutivos | DONE |
| 5 UX de agente · 6 create_study_material · 7 Audit log | DONE |
| 8 Conexão ao Codex | **BLOCKED — decisão humana** (deploy) |
| 9 E2E real | NOT_STARTED (depende de 8) |
| 10 Descoberta por nome | DONE |
| 11 Revisão adversarial | DONE (3 rodadas, veredito final PASS) |

## 8. Riscos conhecidos

- **R-2026-09-13-03**: o plugin Vite regera o bundle; no Windows sai import `npm:C:\...` **inválido para
  Deno**. O bundle oficial precisa ser regenerado no pipeline Linux/Lovable.
- O MCP **publicado hoje serve apenas `echo`** (v0.1.0): endpoint no ar e OAuth correto, mas as 24 tools
  ainda não foram deployadas.
- `config.toml` não declara `[functions.mcp]`; se o deploy aplicar `verify_jwt=on` (default), o gateway
  derruba o endpoint com 401 antes do código rodar.
- O caminho `deploy_edge_function` do conector Supabase **não** regenera o bundle em Linux.
- Só token OAuth **delegado** funciona (JWT de sessão do app é recusado por design).
- Token de confirmação é stateless: replay após o alvo voltar **byte-a-byte** ao mesmo estado exigiria
  nonce persistente (migration → decisão humana).
- Lematização é heurística (sem POS tagger); falsos lemas ficam restritos a `KNOWN_LEMMA`.

## 9. Decisões humanas pendentes

1. Publicar na Lovable para regenerar o bundle em Linux e habilitar o smoke real (FASE 8/9).
2. Autorizar `verify_jwt=false` para o function `mcp` (ou confirmar que o gateway não bloqueia).
3. Autorizar merge de `integration/ape-program-20260913` para `main`.
4. Decidir se o audit log continua em log estruturado ou vira tabela (migration).
5. Reconciliar vault externo × `docs/brain` (divergência pré-existente, ~22 notas).

## 10. Próximos passos exatos

1. ~~Adicionar o teste dedicado do caminho de cards~~ **FEITO**: cards não têm caminho de restauração
   (`TRASH_TARGETS = ["list", "folder"]`), então a garantia equivalente — token morre quando o estado
   muda — está coberta por teste de regressão.
2. Rodar `npm run build` em ambiente Linux/Lovable e confirmar `SEO 100/100` + bundle Deno válido.
3. Deployar o function `mcp` e rodar `node docs/mcp/smoke-mcp.mjs` com `PITECO_MCP_TOKEN`
   (initialize → tools/list → get_my_profile → list_folders → list_lists → get_flashcards).
4. E2E real (FASE 9): criar pasta → lista → 5 cards → reler → remover → restaurar.
5. Conectar o conector no cliente MCP e validar as 24 tools em uso real.

## 11. Como conectar

Ver `docs/mcp/PITECO-MCP-CONNECTION.md` (URL, OAuth DCR + PKCE, requisitos de `Accept`/`SSE`,
checklist humano) e `docs/mcp/smoke-mcp.mjs` (token somente por `PITECO_MCP_TOKEN`).
