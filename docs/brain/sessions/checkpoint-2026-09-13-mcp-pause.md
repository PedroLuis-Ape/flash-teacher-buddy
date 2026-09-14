---
category: test
area: study
cssclasses:
  - ape-ai-note
type: checkpoint
status: paused
date: 2026-09-13
project: App Piteco / APE Education
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[areas/mcp-agent-api]]"
  - "[[26-MCP-E-SEGUNDO-CEREBRO]]"
  - "[[27-CONTEXT-PACKET-E-TELEMETRIA]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[23-GIT-E-WORKTREES]]"
---

# Checkpoint — pausa do MCP (2026-09-13)

## CURRENT OBJECTIVE

Transformar o MCP do Piteco na **camada operacional do app para agentes**: descobrir, entender,
comparar, criar, editar, organizar e validar conteúdo da biblioteca da conta autenticada — sem SQL
manual, sem IDs colados pelo usuário e sempre dentro das permissões reais (token + RLS).

## WHY PAUSED

Parada **deliberada** pelo usuário para reconfigurar a arquitetura de agentes antes de retomar.
Não é BLOCKED técnico: o trabalho está em estado seguro e continuável.

## DONE

- FASE 0 (DOMAIN_MAP) — contratos reais de folders/lists/flashcards/institutions.
- FASE 1 (camada de domínio) — `src/lib/mcp/domain/*`: client scoped ao token, query, scope,
  access, folders, lists, flashcards, profile, search, validation, confirmation, folderWrites,
  listWrites, cardWrites, trash, inventoryInvalidation.
- FASE 2 (tools read-only) — get_my_profile, list_folders, list_lists, get_list, get_flashcards,
  search_my_content.
- FASE 3 (escrita/edição em lote) — create/update folder, create/update list, move_list,
  reorder_lists, duplicate_list, add_flashcards, update_flashcards, remove_flashcards.
- FASE 4 (destrutivos com preview + confirmation token stateless) — preview_delete_list,
  confirm_delete_list, preview_delete_folder, confirm_delete_folder, restore_from_trash.
- Motor linguístico de análise de texto — `src/lib/mcp/learning/*` + tool
  `analyze_text_against_library` (read-only; normalização, lematização heurística, expressões
  preservadas, inventário compacto com fingerprint e cache invalidável).
- Protocolo de contexto do Segundo Cérebro — READ ONCE → COMPACT → SHARE → REUSE, com manifesto
  (`docs/brain/brain-manifest.json`), context packet e telemetria
  ([[27-CONTEXT-PACKET-E-TELEMETRIA]]).
- Documentação de conexão real do MCP — `docs/mcp/PITECO-MCP-CONNECTION.md` + `docs/mcp/smoke-mcp.mjs`.

## IN PROGRESS

- FASE 5 (UX de agente), FASE 6 (`create_study_material`) e FASE 7 (audit log): **não implementadas**.
  Só existe um contrato de teste RED, deixado de propósito e NÃO commitado:
  `src/lib/mcp/__tests__/phase5-7.contract.test.ts` (5 testes falhando por ausência do tool).
- Revisão adversarial (FASE 11): entregue **PARCIAL** antes da parada — veredito **FAIL** com
  2 defeitos HIGH e 2 MEDIUM concretos (registrados abaixo). Os gates automáticos não foram
  executados por ela.

### Estado por fase

| Fase | Estado |
| --- | --- |
| 0 DOMAIN_MAP | DONE |
| 1 Domínio | DONE |
| 2 Tools read-only | DONE |
| 3 Escrita/edição em lote | DONE |
| 4 Destrutivos com confirmação | DONE |
| 5 UX de agente | IN_PROGRESS (só teste RED) |
| 6 create_study_material | NOT_STARTED |
| 7 Audit log | NOT_STARTED |
| 8 Conexão ao Codex | BLOCKED → ver PENDING HUMAN DECISIONS (deploy) |
| 9 E2E real | NOT_STARTED (depende de 8) |
| 10 Descoberta por nome | DONE na prática (resolução nome→id nas tools) |
| 11 Revisão adversarial | IN_PROGRESS (sem veredito) |

## CURRENT GIT STATE

- REPOSITORY: `https://github.com/PedroLuis-Ape/flash-teacher-buddy.git`
- BRANCH: `integration/ape-program-20260913`
- WORKTREE: `C:\Users\pedro\Documents\App-Piteco-Worktrees\ape-discovery-activation-20260913`
- CHECKOUT PRINCIPAL: `C:\Users\pedro\Documents\APP PITECO` (branch `main`)
- HEAD: `bcd91839`
- LAST RELEVANT COMMIT: `bcd91839`
- `origin/main`: `8680e4a8` → branch está **3 commits à frente**; nada foi enviado ao remoto.
- `git status` (não commitado):
  - `M reports/seo-visibility/latest-eval.json` — saída do próprio gate de build (ruído).
  - `M supabase/functions/mcp/index.ts` — artefato gerado; no Windows o plugin emite import
    `npm:C:\...` inválido para Deno. **Nunca commitar.**
  - `?? src/lib/mcp/__tests__/phase5-7.contract.test.ts` — contrato RED da FASE 5/6/7 (intencional).
  - `?? pnpm-lock.yaml`, `?? pnpm-workspace.yaml`, `?? .pnpm-store/`, `?? tmp/` — ruído de ambiente.
  - `.superpowers/sdd/context-packets/mcp-phase5-7-2026-09-13.packet.json` — packet de contexto
    (diretório ignorado pelo git).
- Nada foi resetado, estacado, limpo, mergeado, publicado ou deployado.

## IMPORTANT COMMITS

| Commit | Entrega |
| --- | --- |
| `08bd0be5` | Domínio com escopo pessoal/institucional + 6 tools read-only |
| `9eeef10b` | Conexão real, OAuth, protocolo SSE e smoke autenticado |
| `bcd91839` | Escrita, destrutivos com confirmação, análise de texto e protocolo de contexto |

## FILES / MODULES

- `src/lib/mcp/index.ts` — `defineMcp` (`ape-piteco-mcp`, v0.3.0) com **22 tools** + `instructions`.
- `src/lib/mcp/domain/*` — a única camada que fala com o Supabase.
- `src/lib/mcp/tools/*` — uma tool por arquivo (`defineTool` + Zod estrito + annotations).
- `src/lib/mcp/learning/*` — normalização, lemas, idioma, inventário e análise.
- `src/lib/mcp/__tests__/*` — 18 arquivos / 117 testes verdes no commit `bcd91839`.
- `scripts/brain-index.mjs`, `scripts/context-packet.mjs`, `scripts/brain-telemetry.mjs`,
  `scripts/contextPacket.test.mjs` — toolchain do protocolo de contexto.
- `docs/mcp/` — conexão e smoke; `docs/brain/` — espelho versionado da memória.

## CONTRACTS

- Identidade **sempre** de `ctx.getUserId()` / `ctx.getToken()`; nenhuma tool aceita `user_id` do
  modelo; RLS decide a autorização; **service role proibido** no MCP.
- `system_kind='user'` é obrigatório; pastas/listas de sistema são imutáveis (trigger → `42501`).
- Remoção usa **lixeira** (`deleted_at` + `soft_delete_*` / `restore_*`), nunca hard delete.
- Destrutivos exigem preview + confirmation token stateless (payload + uid + TTL).
- Escopo `personal | institution`; `institutions` é owner-only e membership/roles são de **turma**
  (`turma_membros`). Único ponto de evolução: `assertScopeAccessible`.
- `analyze_text_against_library` é **read-only** e nunca cria cards sozinho.
- Escritas invalidam o inventário de vocabulário (`inventoryInvalidation`).

## TESTS / EVIDENCE

- `vitest run src/lib/mcp` → **18 arquivos / 117 testes PASS** (verificado pelo supervisor em 2026-09-13).
- Typecheck do app limpo no commit; build com **SEO 100/100** nas rodadas anteriores.
- `brain-check` → `BRAIN_CHECK_PASS` (60 notas, 682 wikilinks).
- `brain-index --check` → `BRAIN_INDEX_CHECK_PASS` (97 notas).
- TEST I do motor de vocabulário: 1000 listas / 12.000 cards → **14 requests, 12 páginas, 254 ms**.
- Medição do protocolo de contexto: **−71%** (conservador) e **−85%** (enxuto) de tokens no fluxo
  MAIN → WORKER → REVIEWER → CORREÇÃO → REVIEWER.
- **Não verificado**: runtime real do MCP (nenhuma chamada autenticada ao function publicado), deploy,
  e o bundle oficial gerado em Linux.

## REVIEW ADVERSARIAL (parcial — veredito FAIL)

Defeitos concretos encontrados pela revisão independente, ainda **não corrigidos** (a tarefa foi
pausada antes da correção):

| Severidade | Defeito | Evidência |
| --- | --- | --- |
| HIGH | Token de confirmação de remoção de cards **não vincula `card_ids`** (só lista + contagem): o preview de A poderia confirmar a remoção de B com a mesma contagem | `domain/cardWrites.ts:383-412`, `domain/confirmation.ts:43-45` |
| HIGH | Cache de análise colide entre **instituições do mesmo usuário** (chave usa `userId\|institution` sem o `institutionId`) | `tools/analyzeText.ts:84-86`, `domain/inventoryInvalidation.ts:10-19`, `learning/inventory.ts:180-201` |
| MEDIUM | `addCards` aceita **duplicatas dentro do mesmo lote** no modo `skip` (o conjunto local de existentes não é atualizado) | `domain/cardWrites.ts:191-217` |
| MEDIUM | Remoção de cards usa **dois UPDATEs independentes**: falha parcial pode deixar cards principais e camadas divergentes | `domain/cardWrites.ts:425-441` |

A revisão **não** rodou typecheck, vitest, eslint nem build, e **não** verificou runtime real/RLS.
A revisão também não cobriu o restante dos arquivos por causa da interrupção.

## KNOWN RISKS

- **R-2026-09-13-03** — o bundle `supabase/functions/mcp/index.ts` é regerado pelo plugin Vite; no
  Windows sai inválido para Deno. Ver [[08-RISKS]].
- O MCP publicado hoje serve apenas `echo` (v0.1.0): o endpoint está no ar, com OAuth correto, mas o
  bundle com as tools novas ainda não foi deployado.
- `config.toml` não declara `[functions.mcp]`; se o deploy aplicar o default `verify_jwt=on`, o
  gateway derruba o endpoint com 401 antes do código rodar.
- O caminho `deploy_edge_function` do conector Supabase **não** regenera o bundle em Linux.
- Só token OAuth delegado funciona (JWT de sessão do app é recusado por design).
- O teste RED não commitado deixa `vitest run src/lib/mcp` vermelho (5 falhas) até a FASE 5/6/7.

## OPEN ISSUES

- Divergência entre o vault externo e `docs/brain`: **22 notas** divergentes (14 só no espelho,
  5 só no vault) — condição pré-existente, agora mensurável com `brain-index --compare`.
- Lematização é heurística (sem POS tagger) — falsos lemas ficam restritos a `KNOWN_LEMMA`.
- Cache quente do inventário pode devolver dado antigo até a invalidação (contrato explícito).
- A varredura de biblioteca inteira vive em `learning/supabaseSource.ts`; promover para o domínio é
  follow-up de arquitetura.

## DO NOT BREAK

- Identidade por token + RLS; nunca service role; nunca `user_id` do modelo.
- `system_kind='user'`; lixeira/soft delete; confirmação em destrutivos.
- `analyze_text_against_library` read-only.
- Os 117 testes verdes de `src/lib/mcp` no commit `bcd91839`.
- O protocolo de contexto READ ONCE → COMPACT → SHARE → REUSE ([[27-CONTEXT-PACKET-E-TELEMETRIA]]).

## PREEXISTING CHANGES (não pertencem à tarefa)

- `reports/seo-visibility/latest-eval.json` — saída do gate de build.
- `supabase/functions/mcp/index.ts` — artefato gerado.
- `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.pnpm-store/`, `tmp/` — ruído de ambiente.

## PENDING HUMAN DECISIONS

- Publicar/deployar na Lovable para regenerar o bundle em Linux e habilitar o smoke real (FASE 8/9).
- Decidir se a FASE 7 (audit log) fica em log estruturado (sem migration) ou vira tabela de auditoria
  (migration em produção exige aprovação).
- Reconciliar vault × `docs/brain` (22 notas divergentes).
- Autorizar merge do branch `integration/ape-program-20260913` para `main` (3 commits à frente).

## TEST COMMANDS

- `node node_modules/vitest/vitest.mjs run src/lib/mcp`
- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json`
- `node scripts/brain-check.mjs` · `node scripts/brain-index.mjs --check`
- `node docs/mcp/smoke-mcp.mjs` (exige `PITECO_MCP_TOKEN`)

## NEXT EXACT STEP

1. Reconfigurar a arquitetura de agentes (ver AGENT CONFIG NOTE) e confirmar que o default de
   subagente ficou Luna + High.
2. Abrir o worktree e conferir `git status` + `HEAD` (`bcd91839`).
3. Implementar FASE 5 (metadados/annotations/descrições/erros + `instructions`) usando o teste RED
   existente como contrato: `src/lib/mcp/__tests__/phase5-7.contract.test.ts`.
4. Implementar FASE 6 (`create_study_material`: resolver nome→id, batch em uma inserção, dry-run,
   compensação por soft-delete) e fazer os 5 testes ficarem verdes.
5. Implementar FASE 7 (audit log estruturado via `console.log(JSON.stringify(...))`), sem migration.
6. Rodar `vitest src/lib/mcp`, typecheck, `brain-check` e `npm run build`; exigir 117+ testes verdes
   e SEO 100/100.
7. Rodar a revisão adversarial (FASE 11): IDOR, spoofing, bypass de RLS, service role, mass delete,
   confirmação forjável, idempotência, batch, vazamento de dados.
8. Corrigir somente defeitos concretos; revalidar.
9. FASE 8/9 (dependem de decisão humana): publicar na Lovable, regenerar o bundle em Linux e rodar o
   smoke autenticado (`docs/mcp/smoke-mcp.mjs`) + E2E criar pasta → lista → 5 cards → reler.

## AGENT CONFIG NOTE

**AGENT_CONFIG_REFACTOR_PENDING = true**

A arquitetura de agentes será **reconfigurada antes da retomada**. Uma sessão futura **não** deve
assumir que as políticas atuais de skills/agentes continuam válidas.

Preferência planejada: MAIN com o modelo principal selecionado pelo usuário; SUBAGENTES com
preferência **Luna + reasoning High**. A configuração definitiva será feita antes da retomada.

Estado medido nesta sessão (2026-09-13):

- Política reescrita para **Luna High** (sem Extra High, sem Ultra, sem escalonamento automático) em
  `AGENTS.md` + `policies/clara-model-policy.md` + `clara-model-routing-policy.md` +
  `clara-delegation-scope-policy.md` (MAIN FIRST, contrato de spawn, sem agentes aninhados).
- `config.toml` recebeu `[agents] default_subagent_model = "gpt-5.6-luna"` e
  `default_subagent_reasoning_effort = "high"` (backup em `config.toml.bak-20260913-luna-high`).
- **Medição real**: spawn **sem** override saiu `deepseek/deepseek-flash` + `ultra` (herda a MAIN);
  spawn **com** override explícito saiu `gpt-5.6-luna` + `high`. Ou seja: o default do config ainda
  **não** está em vigor no app em execução — precisa reiniciar (ou o campo não é suportado; não
  verificado após restart). Enquanto isso, o override explícito é o caminho confiável.
- Flags: `EXTRA_HIGH_AUTO_USE = DISABLED`, `ULTRA_AUTO_USE = DISABLED`,
  `EXPENSIVE_AUTO_ESCALATION = DISABLED`, `MAIN_MODEL_CHANGED = NO`.

## RESUME INSTRUCTIONS

1. Identifique o projeto: **App Piteco / APE Education**, repositório
   `flash-teacher-buddy`, worktree `ape-discovery-activation-20260913`.
2. Leia **somente** este checkpoint + [[areas/mcp-agent-api]] + [[27-CONTEXT-PACKET-E-TELEMETRIA]].
   Não releia o vault inteiro.
3. Rode `git -C <worktree> log -1 --format=%h` e confirme que o HEAD é `bcd91839` (ou descendente).
4. Rode `git status --porcelain` e confira as mudanças pré-existentes listadas acima.
5. Verifique se a configuração de agentes já foi atualizada (AGENT CONFIG NOTE); se não, atualize antes
   de abrir subagentes.
6. Continue exatamente do **NEXT EXACT STEP 3** — o contrato RED
   `phase5-7.contract.test.ts` é o ponto de partida.

## Índice do checkpoint

Objetivo: preservar continuidade. Ver também [[01-CURRENT-STATE]], [[07-TESTS]] e [[08-RISKS]].
