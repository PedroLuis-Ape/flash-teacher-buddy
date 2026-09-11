---
cssclasses:
  - ape-ai-note
type: area
domain: supabase-runtime
status: active
priority: critical
last_reviewed: 2026-09-11
related:
  - "[[03-ARCHITECTURE]]"
  - "[[01-CURRENT-STATE]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[areas/adaptive-learning]]"
---

# Runtime Supabase e separação de ambientes

## Propósito

Registrar o mapa de ambientes que impede o App Piteco de abrir vazio ou
perder a aparência de dados depois de uma publicação. Git e o código são a
fonte de verdade da implementação; esta nota guarda o contrato operacional,
as fronteiras e as verificações necessárias para retomada.

## Mapa canônico

| Papel | Projeto | URL | Evidência |
|---|---|---|---|
| Backend de dados de produção | `ymahldldyxvwjeruaxpr` | `https://ymahldldyxvwjeruaxpr.supabase.co` | [VERIFIED-REPO] em `platformRuntime.ts`, `environment-contract.md` e `runtime-data-split.md` |
| Projeto gerenciado para migrations, administração e diagnósticos | `xrnfhhoxmmstagmelvyi` | `https://xrnfhhoxmmstagmelvyi.supabase.co` | [VERIFIED-REPO] em `supabase/config.toml`, `runtimeBootstrap.ts` e documentação canônica |

O projeto gerenciado não pode substituir o backend de dados do navegador sem
inventário, migração integral, validação de ownership, comparação de contagens,
testes de leitura/escrita, rollback e aprovação explícita. Essa troca não foi
executada nesta sessão.

## Fonte única do runtime do navegador

O ponto de entrada é `src/integrations/supabase/platformRuntime.ts`.

- `MANAGED_SUPABASE_PROJECT_ID` identifica o projeto técnico: `xrnfhhoxmmstagmelvyi`.
- `PRODUCTION_DATA_PROJECT_ID` identifica as contas e dados existentes: `ymahldldyxvwjeruaxpr`.
- `PRODUCTION_DATA_URL` é derivada do projeto de dados de produção.
- `PRODUCTION_DATA_RUNTIME` é o fallback explícito para o conjunto de produção.
- `readPlatformRuntime()` rejeita runtime externo que não aponte para o projeto de dados de produção.
- `client.ts`, `publicClient.ts`, `guestSyncClient.ts` e o diagnóstico de capacidades de importação usam o runtime resolvido.

Não editar a URL/chave manualmente no cliente, não trocar apenas uma variável
`VITE_SUPABASE_*` e nunca colocar service role, senha, token administrativo ou
segredo de Edge Function no frontend. A chave publicável pode estar no bundle;
a autorização real continua em Auth, RLS, RPCs e funções do servidor.

## Preflight de ambiente

Antes de investigar listas vazias, `Invalid API Key`, importação ou publicação:

```bash
node scripts/check-platform.mjs
```

O resultado esperado neste checkout é:

```text
Managed project xrnfhhoxmmstagmelvyi; production data runtime ymahldldyxvwjeruaxpr.
```

Depois, conferir `readPlatformRuntime()` e o conjunto atômico de URL, project
ref e chave pública. Não criar dados fictícios para compensar falha de
descoberta.

## Lacuna encontrada na revisão

[REVALIDATE] Ainda existem consumidores auxiliares que leem
`import.meta.env.VITE_SUPABASE_URL`, `VITE_SUPABASE_PROJECT_ID` ou
`VITE_SUPABASE_PUBLISHABLE_KEY` diretamente, entre eles o caminho legado de
`src/lib/edgeTTS.ts`, o importador de Reino em `src/pages/KingdomImport.tsx`, o
diagnóstico inicial em `src/main.tsx`/`SystemStatus.tsx` e a leitura otimista de
sessão em `src/hooks/useAuthUser.ts`. Isso não altera o contrato dos clientes
principais já verificados, mas precisa ser auditado antes de declarar que todo
consumidor do browser é imune a configuração divergente.

## Dependências e riscos

- [[03-ARCHITECTURE]] — fronteira entre runtime do app e projeto administrado.
- [[07-TESTS]] — `check-platform`, typecheck e testes de contrato.
- [[08-RISKS]] — preview/Lovable e consumidores legados ainda não unificados.
- [[01-CURRENT-STATE]] — estado de publicação e dados.

## Status

[VERIFIED-REPO] O contrato documentado pelo usuário coincide com os valores
atuais de código e documentação neste worktree.

[REVALIDATE] Não houve inspeção read-only do projeto Supabase remoto nesta
sessão; conectividade, schema, RPCs, RLS e dados de produção permanecem fora
do escopo desta atualização documental.

## Próximo passo seguro

Em uma tarefa funcional separada, migrar os consumidores auxiliares para uma
fonte runtime coerente, começando pelos caminhos que fazem requisições HTTP
diretas. Reexecutar testes e `node scripts/check-platform.mjs`; só depois
validar o build e o preview autenticado.
