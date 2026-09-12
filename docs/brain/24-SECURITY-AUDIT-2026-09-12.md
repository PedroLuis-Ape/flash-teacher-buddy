---
cssclasses:
  - ape-ai-note
type: security-audit
status: active
area: security
last_reviewed: 2026-09-12
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[03-ARCHITECTURE]]"
  - "[[06-BUGS]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[areas/supabase-runtime]]"
  - "[[23-GIT-E-WORKTREES]]"
---

# Auditoria de segurança — 2026-09-12

## Escopo e método

- 20 categorias: autenticação/sessão, IDOR, RLS, secrets, frontend/XSS, validação
  de entrada, SQL, economia (PTS/PiteCOIN/loja), storage, APIs, rate limit,
  dependências, headers, PWA/service worker, extensão Chrome, logs, erros,
  CSRF/CORS, abuso de lógica de negócio e testes controlados.
- Base auditada: `main` @ `096a52b9`, três análises paralelas somente-leitura,
  mais verificação própria das evidências críticas.
- Scanners executados: `scripts/audit-security.mjs` (0 erros, 26 avisos) e
  `scripts/audit-dependencies.mjs` (produção: 4 moderadas, 0 altas; dev: 3 altas).
- Advisor do Supabase no projeto gerenciado `xrnfhhoxmmstagmelvyi`: 7 tabelas
  com RLS sem policy, 16 funções `SECURITY DEFINER` executáveis por `anon`,
  42 por `authenticated`.
- Memória canônica de segurança reconciliada:
  `docs/security/LOVABLE_SECURITY_MEMORY.md`. As famílias `get_portal_*`,
  `get_public_*`, `list_public_*` e o `ping` são exceção pública documentada e
  **não** devem ser tratadas como falha.

## Causa-raiz estrutural encontrada

`SECURITY DEFINER` **ignora RLS**. Várias RPCs recebiam a identidade do ator
(`p_user_id` / `p_buyer_id`) e até o preço (`p_price`) pela requisição do
cliente, sem nunca comparar com `auth.uid()` — a autorização existia apenas na
interface. Duas variantes do mesmo defeito:

1. identidade do cliente usada como fonte de verdade (IDOR de escrita);
2. comparação `p_user_id <> auth.uid()` que, com JWT anônimo, resulta em `NULL`
   e **não** dispara o bloqueio (bypass silencioso).

## Corrigido — commit `90fb5144`

Migration `20260912233000_authorization_hardening_v1.sql` + contrato
`src/security/authorizationHardening.contract.test.ts`:

- Helper `security_actor_matches_v1(p_claimed)` resolve a identidade pelo JWT e
  aceita `service_role` para rotinas internas.
- Funções renomeadas para `*_unsafe_v1` (histórico preservado) e reexpostas por
  wrappers com a mesma assinatura, que validam a identidade antes de delegar:
  lixeira (`soft_delete_folder/list`, `restore_folder/list/flashcard`),
  `bulk_soft_delete_lists/folders`, `claim_gift_atomic`, `equip_skin_atomic`,
  `process_exchange`, `update_own_profile` e `swap_list_sides`.
- `process_skin_purchase` passa a exigir identidade do JWT **e** a usar
  `skins_catalog.price_pitecoin` como preço autoritativo; divergência devolve
  `PRICE_MISMATCH`.
- `purge_expired_trash()` sai da API (apenas `service_role`).
- `REVOKE ALL ... FROM PUBLIC, anon` + `GRANT EXECUTE ... TO authenticated,
  service_role` em todas as funções do escopo.

Validação: contrato `16/16`; suíte `260` arquivos e `1601` testes; typecheck e
build aprovados. As versões `*_unsafe_v1` ficam fora da API.

## Pendências reais (não corrigidas)

- [ALTO] `store-admin-upsert`, `store-admin-activate` e `store-admin-items`
  autorizam só pelo segredo `X-Ingest-Secret`, sem JWT nem papel
  `developer_admin` (diferente da irmã `store-admin-batch-import`, que está
  correta). Preferir o mesmo gate de papel e comparação em tempo constante.
- [MÉDIO] `get_user_card_counts(_user_id, _institution_id)` e
  `get_subscribed_teachers_with_stats(_student_id)` ainda filtram por
  parâmetro do cliente (leitura de dados alheios).
- [MÉDIO] `has_role(_user_id, _role)` funciona como oráculo de papéis e é
  chamado por policies — endurecer exige cuidado para não quebrar RLS.
- [MÉDIO] `search_users()` pagina perfis de toda a base; falta `REVOKE`.
- [MÉDIO] ~60 funções `SECURITY DEFINER` sem `REVOKE FROM PUBLIC`; a varredura
  em bloco é de alto risco e exige inventário com `GRANT` caso a caso.
- [MÉDIO] View `public.public_profiles` com `security_invoker = false` expõe
  UUID de conta para `anon` — barateia qualquer IDOR remanescente.
- [MÉDIO] `sessionCoalescing` mantém cache de `getSession()` sem geração: uma
  resposta em voo pode repovoar a sessão anterior após logout/troca de conta.
- [MÉDIO] Logout não limpa IndexedDB/outbox (`ape-offline`); conteúdo privado
  permanece legível no dispositivo. Exige política de retenção antes de apagar
  (risco de perder estudo offline não sincronizado).
- [MÉDIO] `useAuthUser` deriva identidade do `localStorage` e usa resolvedor de
  URL diferente do contexto, expondo `userId` em estado `stale`.
- [BAIXO] Bucket `skins` permite listagem pública; `OAuthConsent` navega para
  `redirect_url` do servidor sem allowlist de host.
- [DRIFT] `ensure_piteco_profile` e `swap_flashcards_sides` existem na API mas
  não têm definição em nenhuma migration — precisam de `pg_get_functiondef`
  para virar migration versionada.

## Limite de verificação

[UNKNOWN] O conector Supabase alcança apenas o projeto gerenciado
`xrnfhhoxmmstagmelvyi`. O runtime de dados do app é
`ymahldldyxvwjeruaxpr` (ver [[areas/supabase-runtime]]), que **não** está
acessível. Portanto: a migration acima está no Git e validada por testes, mas
**não há prova de que esteja aplicada em produção**, e o advisor não cobre o
banco que os usuários realmente usam.

Related: [[08-RISKS]] · [[06-BUGS]] · [[07-TESTS]] · [[areas/supabase-runtime]] · [[01-CURRENT-STATE]]

