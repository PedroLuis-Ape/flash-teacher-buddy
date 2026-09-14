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

## FASE 3/4 — escrita e operações destrutivas (2026-09-13)

- [DECISAO VIGENTE] Objetos existentes são resolvidos por POSSE
  (findOwnedFolder/findOwnedList: owner_id ou folders.owner_id = auth.uid(),
  system_kind = user, não deletado), sem exigir que o modelo declare o escopo:
  o escopo é derivado do próprio objeto. Criar exige destino explícito
  (folder_id em create_list; institution_id opcional em create_folder).
- [DECISAO VIGENTE] create_list herda o institution_id da pasta e move_list
  espelha o destino (folder_id + institution_id + order_index): lista e pasta
  nunca discordam do workspace.
- [DECISAO VIGENTE] Study settings são domínio fechado: study_type só aceita
  language|general (CHECK do banco), primary_side a|b e idiomas em BCP-47
  (aceita o nome "English" e normaliza para en).
- [FATO CONFIRMADO] Batch real: add_flashcards faz UM insert multi-linha por
  chamada (até 200 cards) com dedupe opcional por par (term+translation)
  normalizado dentro da lista; update_flashcards tem dois modos — mesmos
  valores para N cards (1 UPDATE) e valores por card (1 UPSERT multi-linha,
  com pré-validação de posse e not_found por card).
- [FATO CONFIRMADO] duplicate_list copia a lista + deck ativo com ids novos,
  remapeando parent_card_id e gerando identidade de grupo nova
  (status_group_uid), então Favorito/Lista vermelha não são herdados; se um
  lote falha, a cópia parcial vai para a lixeira (compensação via
  soft_delete_list).
- [DECISAO VIGENTE] Remoção de cards é soft delete com cascata de camadas
  (parent_card_id), igual ao fluxo do app; acima de 25 linhas exige dry_run +
  confirmation_token.
- [DECISAO VIGENTE] Destrutivos de lista/pasta passam pelas RPCs do produto
  (soft_delete_list, soft_delete_folder, restore_list, restore_folder) com
  p_user_id = auth.uid(). O MCP nunca faz hard delete: a purga de 7 dias é do
  produto e restrita a service_role.
- [DECISAO VIGENTE] O confirmation token é STATELESS: HMAC-SHA256 de
  (ação|uid|objeto|escopo|conjunto ordenado de ids|contagem previsualizada|
  impressão do estado atual|exp) com chave = bearer verificado da requisição,
  TTL de 600 s, sem tabela e sem migration. A impressão é um SHA-256 dos ids,
  updated_at e deleted_at das linhas afetadas, recalculado no momento da
  confirmação; portanto uma mutação posterior, inclusive restore, invalida o
  mesmo token. Consequências: não é forjável sem o bearer, é específico da
  conta e exige novo preview quando o objeto mudou. Refresh de sessão entre
  preview e confirmação também invalida o token — falha segura.
- [LIMITE RESIDUAL] Sem nonce/registro de consumo, um token ainda pode ser
  reapresentado enquanto o estado permanecer byte-a-byte idêntico; operações
  já removidas respondem idempotentemente e não repetem a mutação. Bloquear
  esse replay residual exigiria estado persistente (migration/tabela) e decisão
  humana explícita.
- [FATO CONFIRMADO] Reexecutar remoção é idempotente: objeto já removido
  responde already_deleted/already_active, nunca erro destrutivo.
- [VERIFIED-TEST] 12 arquivos / 89 testes do MCP, incluindo GATE_WRITE e
  GATE_DESTRUCTIVE exercitados pelo boundary autenticado (handler real da tool
  com vi.mock de @supabase/supabase-js sobre o fake PostgREST).
- [NAO VERIFICADO] A RLS real continua não exercitada: a prova de isolamento
  entre contas é de domínio (filtros de posse) sobre o fake. Ver [[08-RISKS]].
- Ver [[sessions/2026-09-13-mcp-phase3-4]].

## Contrato compartilhado com o motor de vocabulário (2026-09-13)

- [DECISAO VIGENTE] A chave do inventário é userId + "|" + scopeName(scope) +
  "|" + institutionId (ou `personal` no escopo pessoal) — a MESMA usada por
  analyze_text_against_library. Toda escrita do MCP chama
  invalidateScopeInventory(userId, institutionId) no fim da operação; quem
  criar novas rotas de escrita precisa manter esse contrato.
- [FATO CONFIRMADO] O escopo de uma lista vem do embed da pasta
  (folders.institution_id); mover lista invalida origem e destino.
- [FATO CONFIRMADO] analyze_text_against_library entrou no index.ts no grupo
  read-only (após search_my_content); o motor de vocabulário é do outro worker
  e não foi editado por este lote.

## FASE 5/6/7 — UX de agente, create_study_material e audit log (2026-09-13)

- [DECISAO VIGENTE] Toda tool publicada recebe as quatro annotations booleanas
  (`readOnlyHint`, `idempotentHint`, `destructiveHint`, `openWorldHint`) e usa
  o envelope `{ok:true,...}` ou `{ok:false,error:{code,message,hint}}`.
- [FATO CONFIRMADO] `create_study_material` resolve pasta/lista por id ou nome
  dentro do escopo pessoal/institucional, falha com candidatos `id — caminho`
  quando o nome é ambíguo, suporta `dry_run`/`preview` sem escrita e usa uma
  inserção batch para os cards. Criações parciais são compensadas pela
  lixeira via RPC do produto.
- [FATO CONFIRMADO] Escritas e destrutivos emitem `mcp.audit` como JSON local
  com uid, tool, escopo, alvo por id, contagem, resultado e duração; nenhum
  texto de card ou token é serializado. Evolução futura: substituir o emissor
  local por um sink/tabela de auditoria mediante migration e decisão explícita.
- Ver [[sessions/2026-09-13-mcp-phase5-7]] · [[27-CONTEXT-PACKET-E-TELEMETRIA]].
- [LIMITE] A invalidação é por processo (Map em memória do isolate); o TTL de
  60 s é o limite de obsolescência nos demais isolates. Ver [[08-RISKS]].

## Bundle Deno (contrato de publicação)

- `supabase/functions/mcp/index.ts` é artefato GERADO. Nunca editar à mão.
- No Windows, o plugin Vite gera import inválido; use `npm run mcp:bundle` (gerador próprio, entrada relativa) e `npm run mcp:bundle:check` como gate.
- O bundle commitado é a versão válida com as 24 tools; um build Linux pode regerá-lo por cima sem conflito (mesmo banner).

