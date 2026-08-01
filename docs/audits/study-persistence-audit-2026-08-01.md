# Auditoria de persistência dos modos de estudo — 2026-08-01

## Escopo e baseline

- Repositório: `PedroLuis-Ape/flash-teacher-buddy`.
- Baseline auditado: merge `6a714146` (PR #379).
- A conta de produção permanece no projeto `ymahldldyxvwjeruaxpr`.
- `xrnfhhoxmmstagmelvyi` permanece o projeto administrativo para migrations e diagnósticos.
- Nenhuma migration remota, escrita de dados, alteração de Auth/RLS ou publicação foi executada por esta auditoria.

## Mapa final de fontes de verdade

1. Preset persistido: `user_study_preferences` por `user_id + game_mode`, com override de lista por `user_id + list_id + game_mode`.
2. Sessão em andamento: `study_sessions` por `user_id + list_id + mode + session_scope_key`, com `settings_snapshot` e `session_snapshot`.
3. Fallback local: snapshots versionados no navegador, sempre escopados por conta/lista/modo/escopo; o snapshot v3 não depende da assinatura exata do deck.
4. Offline: IndexedDB v3 por `userId + listId`; registros v1/v2 sem proprietário comprovável não são lidos.
5. URL: apenas intenção explícita de lançamento/override. Ausência de direção não cria `dir=any` e permite que o preset escopado prevaleça.

Precedência: sessão válida e compatível → preset de lista → preset global → default. Um parâmetro explícito de URL pode sobrescrever a intenção daquela abertura; ele não substitui silenciosamente uma sessão existente de outro escopo.

## Causas encontradas

- Sessões antigas não carregavam identidade de ordem, filtro, direção ou fluxo; isso permitia escolher uma fila apenas pelo conjunto aproximado de cards.
- O Misto restaurava local antes de remoto e não reparava decks com cards adicionados/removidos.
- A modal de configurações usava o contexto global/`flip`, mesmo quando aberta dentro de outro modo ou lista.
- A direção ausente era convertida em `any` pelo gate de rota.
- Preferências de atividade/correção de escrita usavam localStorage global por modo, sem conta/lista.
- O offline store original era indexado somente por `listId`.
- `unscramble` e `pronunciation` não estavam na allow-list da migration de sessões.

## Correções implementadas nesta alteração

- Contrato compartilhado de `session_scope_key` e snapshots de contexto.
- Migration aditiva `20260801143000_study_persistence_context_v1.sql`, com campos de contexto, estado rico, allow-list completa e índice parcial de sessões abertas.
- Campos persistidos para atividade de escrita, lado de reescrita e correção.
- Confirmação da resposta do banco após upsert de preferências; falha sem confirmação entra no retry seguro.
- Restore remoto de rodadas de domínio usando `session_snapshot`, além do fallback local.
- Reparação de snapshots quando o deck muda; dados incompatíveis continuam sendo rejeitados quando não há interseção segura.
- Misto passa a comparar `updatedAt`, consumir direção/filtro/ordem/fluxo escopados e persistir contexto explícito.
- Offline v3 user-scoped sem remoção automática dos registros legados.
- Hub, modal e componentes de escrita deixam de compartilhar configurações entre contas/listas.

## Validação executada

- `tsc --noEmit`: passou.
- `vitest run --passWithNoTests`: passou com 200 arquivos e 1.202 testes.
- ESLint: 0 erros e 69 avisos preexistentes.
- Build Vite: passou; apenas avisos já existentes de CSS/chunks.
- Validadores públicos, prerenderização e `seo:visibility:score`: passaram; score local 100/100.
- Diagnóstico remoto somente leitura em `xrnfhhoxmmstagmelvyi`: projeto `ACTIVE_HEALTHY`, 31 tabelas públicas relevantes presentes, migrations existentes `20260719150435_atomic_layered_card_groups` e `20260719150442_import_capabilities_v1`; a migration nova `20260801143000_study_persistence_context_v1` ainda não foi aplicada.
- Supabase CLI: indisponível no ambiente deste agente; nenhuma regeneração automática de tipos foi possível. `src/integrations/supabase/types.ts` foi sincronizado manualmente com a migration proposta.

## Validação ainda necessária antes de publicar

- Revisar e aplicar a migration somente após backup operacional e aprovação no projeto administrativo; promover o mesmo artefato para o ambiente autorizado, sem alteração destrutiva.
- Regenerar os tipos Supabase após a aplicação da migration e consultar o RPC/capabilities no ambiente correto.
- Executar um teste real de continuidade, retry idempotente e rollback usando contas e listas de teste autorizadas.
- Manual: duas contas no mesmo navegador, reload/pagehide, duas abas, offline→online, mobile, todos os modos e troca de cards durante uma sessão.
- Confirmar que o frontend publicado pela Lovable aponta para o backend `ymahldldyxvwjeruaxpr`; não usar `xrnf` como substituto de dados de produção.

## Riscos e rollback

- Rows antigas de `study_sessions` sem `session_scope_key` não são restauradas pelo novo caminho; continuam preservadas e uma nova sessão contextual é criada.
- Offline v1/v2 permanece armazenado, mas não é reutilizado automaticamente; o usuário precisa baixar novamente a lista autenticado.
- A migration é aditiva e não exclui dados. Em regressão, reverta o frontend/feature flag e mantenha as colunas novas; não faça rollback destrutivo de schema.
- Não fazer merge, deploy, publicação ou migration remota automaticamente; o próximo passo é revisão do PR e execução dos checks do provedor.
