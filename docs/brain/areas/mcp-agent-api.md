---
cssclasses:
  - ape-ai-note
type: area
domain: mcp
status: active
priority: high
last_reviewed: 2026-09-13
related:
  - "[[01-CURRENT-STATE]]"
  - "[[03-ARCHITECTURE]]"
  - "[[04-DECISIONS]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[10-CONTEXT-FEEDING-RULE]]"
  - "[[24-SECURITY-AUDIT-2026-09-12]]"
  - "[[areas/supabase-runtime]]"
  - "[[sessions/2026-09-13-mcp-fase1-2-read]]"
---

# MCP do Piteco — camada operacional para agentes

## Objetivo

Transformar o MCP existente (src/lib/mcp/) na camada operacional do Piteco
para agentes (Codex/ChatGPT), com o agente descobrindo, entendendo, comparando,
criando, editando e organizando DENTRO das permissoes reais da conta
autenticada. supabase/functions/mcp/index.ts e artefato auto-gerado pelo
plugin Vite (mcpPlugin()); a fonte de verdade e src/lib/mcp/.

## Modelo de autenticacao (DECISAO VIGENTE)

- O MCP usa OAuth via Supabase (auth.oauth.issuer, audiencia authenticated).
- ctx.getUserId() (claim sub verificado) e ctx.getToken() sao a UNICA fonte de
  identidade. Nenhuma tool aceita user_id, owner_id ou role.
- createUserScopedClient(token) monta um client Supabase com a chave publica
  (anon) + Authorization Bearer do usuario. Nao existe service role no MCP.
- O backend de dados vem de readPlatformRuntime(): o MCP aponta para o mesmo
  projeto de dados do app (ymahldldyxvwjeruaxpr).
- Envelope unico: {ok:true,...} / {ok:false,error:{code,message,hint}} com
  isError. Erros do PostgREST sao traduzidos (42501 forbidden, 22P02
  invalid_input, PGRST116 not_found, resto unavailable), sem mensagem crua.

## Camada de dominio (FASE 1)

- Arquivos: src/lib/mcp/domain/errors.ts, client.ts, query.ts, scope.ts,
  folders.ts, access.ts, lists.ts, flashcards.ts, profile.ts, search.ts.
- Tool -> dominio -> Supabase. Nenhuma tool escreve SQL ou pipeline proprios.
- Paginacao por construcao: resolvePage (default 20/25, tetos 50/100/25) e
  retorno com returned, total_count e has_more.
- sanitizeSearchTerm remove , ( ) * % _ barra e aspas antes de montar o
  filtro PostgREST.
- Busca literal (ilike), NAO analise linguistica: decidir vocabulario novo
  pertence as fases de analise de texto.
- Seguranca em profundidade: mesmo onde a RLS permitiria ler conteudo
  visibility=public de outra conta, o dominio estreita por
  owner_id = auth.uid(); cards tambem sao filtrados por user_id.

## Escopo / WORKSPACE (DECISAO VIGENTE)

- LibraryScope = personal | institution(institutionId).
- Pessoal = institution_id IS NULL + class_id IS NULL (mesma regra da
  Biblioteca do produto).
- Institucional = institution_id = X + posse verificada.
- Fora da biblioteca do agente: conteudo de turma (class_id), colecoes de
  sistema (system_kind diferente de user) e lixeira (deleted_at).

## Modelo real de instituicoes (REVALIDADO 2026-09-13)

- [FATO CONFIRMADO] NAO existe membership de instituicao no produto:
  public.institutions e owner-only (auth.uid() = owner_id) e
  folders/lists/turmas.institution_id sao o vinculo.
- [FATO CONFIRMADO] Membership e roles existem em TURMA: public.turmas
  (owner_teacher_id), public.turma_membros (role turma_role, ativo) e
  public.turma_membership_events (workflow com status canonico).
- [CONSEQUENCIA] Entrar em instituicao de terceiros nao e possivel hoje;
  quando existir membership, o unico ponto a evoluir e assertScopeAccessible.

## Contratos de dados usados

- folders: owner_id, system_kind = user, deleted_at is null, class_id is null,
  institution_id (escopo), title/description, lang_a/lang_b, tts_enabled.
  Nao existe order_index em folders.
- lists: a PASTA e a autoridade de escopo (folders!inner filtrado por
  owner_id), porque listas legadas nem sempre repetem owner_id.
  order_index e primary_side fazem parte da metadata da lista.
- flashcards: ordem canonica do deck = created_at, depois id; deleted_at is
  null; layer_index e parent_card_id fazem parte das camadas.
- list_count de pasta usa o embed lists(id,deleted_at,system_kind) e conta
  apenas listas ativas de usuario (mesma forma da Biblioteca do produto).

## Estado das fases

- FASE 1 (dominio) e FASE 2 (tools read-only) — DONE em nivel unitario:
  get_my_profile, list_folders, list_lists, get_list, get_flashcards e
  search_my_content, todas readOnlyHint e idempotentHint.
- GATE_READ — PASS em nivel de dominio/testes (8 arquivos, 51 testes).
  Nenhuma chamada real ao Supabase foi executada nesta rodada.
- FASE 3+ (create/update/delete, idempotencia, confirmacao em dois passos,
  audit log, analise de texto e operacoes em lote) — nao implementadas.

## Riscos conhecidos

- @lovable.dev/mcp-js 0.20.x no Windows gera bundle invalido para Deno
  (import npm:C:...); a regeneracao correta precisa do pipeline oficial
  Linux/Lovable. Nao commitar o artefato regenerado localmente.
- Os filtros aninhados flashcards -> lists!inner -> folders!inner seguem
  padrao ja usado no app, mas so serao confirmados na primeira chamada real;
  falha vira erro controlado, nao vazamento.
- A busca e ilike (sensivel a acento) — sem busca semantica ou vetorial.

## Testes que protegem a area

- src/lib/mcp/__tests__/: fake PostgREST (fakeSupabase.ts), fixtures com
  conta A e conta B, testes de dominio, de superficie (toolsReadOnly) e de
  boundary autenticado (toolsAuthenticated, com vi.mock de
  @supabase/supabase-js). Ver [[07-TESTS]].

## Proximo passo

Expor o escopo institucional nas tools, rodar smoke autenticado real e seguir
para a FASE 3 reutilizando esta camada. Ver
[[sessions/2026-09-13-mcp-fase1-2-read]].
