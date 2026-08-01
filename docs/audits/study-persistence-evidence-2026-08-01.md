# Evidências da auditoria de persistência — 2026-08-01

Este documento complementa `study-persistence-audit-2026-08-01.md`. Ele separa o que foi demonstrado por código/teste do que ainda depende de migration aplicada, sessão autenticada e publicação pela Lovable.

## Regra de precedência consolidada

1. A rota resolve o contexto de acesso e aguarda a autenticação quando necessário.
2. O carregador compartilhado obtém o deck e diferencia `loading`, `retrying`, `ready`, `confirmed-empty`, `failed` e `cancelled`.
3. Uma sessão válida do mesmo usuário, escopo, lista e modo vence o preset e restaura seu próprio `settings_snapshot`, fila, índice, resultados, rodada e camada.
4. Sem sessão compatível, o preset da lista vence o preset global; defaults só entram quando não há preset.
5. URL só sobrescreve uma intenção explicitamente fornecida para aquela abertura. Ela não inventa `dir=any` nem mistura fila de outra identidade.
6. Snapshot local é fallback imediato e é aceito somente quando pertence à mesma identidade de sessão. A confirmação remota continua sendo necessária para continuidade entre dispositivos.

## Mapa técnico de responsabilidades

| Dado | Fonte durável | Fallback imediato | Escopo obrigatório | Evidência |
|---|---|---|---|---|
| Preset do modo | `user_study_preferences` / override de lista | cache de preferência versionado | usuário + modo (+ lista no override) | `studyPreset.ts`, `studyPreferenceRepository.ts` |
| Sessão | `study_sessions.session_snapshot` | snapshot local v3 | usuário + lista/escopo + modo; `session_scope_key` estável e snapshot de configurações separado | `useStudyEngine.ts`, `MixedStudy.tsx` |
| Fila/posição | snapshot da sessão | localStorage | mesma sessão e deck atual | `studySessionSnapshot.ts` |
| Camada visível | snapshot `layer` | `studyLayerSnapshot` | mesmo card jogável e sessão | `useStudyEngine.ts`, `Study.tsx` |
| Favorito/Foco Vermelho | legado por compatibilidade; pipeline estável por flag | cache/query/outbox | usuário + grupo | `useGroupStatusGate.ts`, `cardStatusIdentity.ts` |
| Progresso | `flashcard_progress` | estado local até flush | usuário + card; lista é contexto atual | `useStudyEngine.ts`, RPC v1 aditivo |
| Offline | IndexedDB v3 | estado em memória | usuário + lista | `offlineStore.ts`, `useOffline.ts` |

## Matriz dos 30 checks operacionais

`Evidenciado` significa coberto por implementação e teste local. `Parcial` significa que há contenção ou contrato, mas falta prova de runtime/ambiente. `Pendente` exige migration aplicada, acesso autenticado autorizado ou teste manual real.

| # | Critério | Status | Evidência / lacuna |
|---:|---|---|---|
| 1 | Responsabilidade única entre URL, React, local e banco | Parcial | Contrato documentado; ainda há superfícies legadas fora do engine comum. |
| 2 | Preset isolado por usuário e modo | Evidenciado | Migration/repositório e testes de preferência. |
| 3 | Sessão isolada por usuário, lista, escopo e modo | Parcial | identidade estável por usuário/lista/modo, leitura compatível de chaves v1 e RLS; aplicação remota ainda pendente. |
| 4 | Restauração do card/ordem/índice exatos | Parcial | Sanitização e escolha de snapshot mais novo; E2E real pendente. |
| 5 | Sem entrada/requisição repetida concorrente | Parcial | geração/abort no engine e generation guard no Misto; duas abas reais pendentes. |
| 6 | Estados loading/auth/retry/ready/empty/failure/cancelled distintos | Evidenciado no loader | Testes de contrato; runtime por rota ainda pendente. |
| 7 | `[]` transitório não vira vazio confirmado | Evidenciado no loader | testes de deck-loader/readiness; teste real de token pendente. |
| 8 | Preset individual de cada modo | Evidenciado | `gameMode` no modelo e cache. |
| 9 | Configurações específicas não contaminam outro modo | Parcial | tipagem/escopo corrigidos; matriz manual dos sete modos pendente. |
| 10 | Nova lista usa preset do modo | Parcial | resolver implementado; prova em outro dispositivo pendente. |
| 11 | Sessão restaura settings, rodada, filtros, resultados e camada | Parcial | `settings_snapshot` agora é reaplicado por overrides efêmeros em Study e Misto; snapshots v2/adaptive e camada remota estão cobertos no código, mas o banco aplicado e o E2E autorizado continuam pendentes. |
| 12 | Identidade de sessão inclui usuário e lista | Evidenciado no código | chaves e filtros; autenticação real pendente. |
| 13 | Isolamento entre usuários | Parcial | offline v3 e queries escopadas; RLS real não foi executado. |
| 14 | Isolamento entre listas | Evidenciado no novo storage key do Misto | E2E A/B pendente. |
| 15 | Isolamento entre modos | Evidenciado no contrato | allow-list/migration ainda precisa ser aplicada. |
| 16 | Cards em camadas preservam grupo, entrada, camada e status | Parcial | `status_group_uid` participa do deck/status; migration remota pendente. |
| 17 | Deck alterado é reparado sem zerar silenciosamente | Evidenciado no adaptive repair | casos reais de remoção/nova camada pendentes. |
| 18 | Resposta antiga não sobrescreve deck atual | Parcial | fila `createLatestWriteQueue` serializa snapshots e descarta pendências invalidadas; navegação autenticada rápida ainda precisa de E2E. |
| 19 | Cancelamento de rota/conta/geração é descartado | Parcial | loader, Misto e fila de snapshots têm abort/guards/invalidação; logout/login manual pendente. |
| 20 | Refresh de auth não exibe falso vazio | Parcial | contrato de acesso/readiness; ambiente publicado pendente. |
| 21 | Nenhuma sessão é criada com `cards_order` vazio | Evidenciado no engine | criação só ocorre após deck elegível; confirmação no banco autorizado ainda pendente. |
| 22 | Precedência e responsabilidades estão documentadas | Evidenciado | relatório principal e este mapa. |
| 23 | Sem retry/spinner infinito, restart silencioso ou DOM frágil | Parcial | watchdogs e recovery; teste manual mobile/slow pending. |
| 24 | Último card/respondida não é perdido por debounce | Parcial | `saveProgressNow` agora aguarda o buffer de respostas; Misto aguarda gravações pendentes e `persistNow`; fluxo real em sete modos ainda pendente. |
| 25 | Sem duplicação paralela de persistência | Parcial | fila de snapshots e writer de progresso compartilhados serializam gravações; fallback sem RPC ainda é somente compatibilidade. |
| 26 | Desktop/mobile, offline, reload, close/reopen, auth, público/privado | Pendente | requer matriz manual autorizada. |
| 27 | Sete modos percorrem boot, primeiro card, resposta e saída | Pendente | cobertura unitária parcial; E2E real não executado. |
| 28 | Auditoria, causa-raiz, testes, rollback e evidências | Evidenciado | relatórios, migrations aditivas, testes e PR. |
| 29 | Lista → Hub → jogo → primeiro card → saída → retorno | Pendente | repetir manualmente no ambiente publicado. |
| 30 | Gates e publicação sem declarar sucesso falso | Parcial | typecheck/testes locais passam; migration/provedor/publicação permanecem fora deste agente. |

## Alterações desta etapa

- `prepareLayeredStudyDeck` agrupa por `status_group_uid` quando disponível e preserva `__statusGroupUid`; mantém fallback compatível para `parent_card_id`.
- `resolveCardStatusIdentity` expõe `stableGroupId` sem colocar esse UUID no payload de limpeza legado.
- `Study` usa o pipeline estável somente quando `new_status_pipeline` está explicitamente em `on`; o padrão continua `off`.
- `MixedStudy` passou a usar chave local com usuário/lista/modo/escopo, confirma updates de `study_sessions` e guarda `cards_order` como ordem jogável, deixando o snapshot rico em `session_snapshot`.
- timers de persistência do Misto têm geração e não podem disparar depois que a identidade ativa mudou.
- novo RPC aditivo `record_flashcard_progress_v1` usa evento deduplicado e `ON CONFLICT` atômico; enquanto não aplicado, há fallback confirmado e limitado.
- o RPC de progresso valida, antes de qualquer escrita `SECURITY DEFINER`, a correspondência card/lista e o mesmo limite de acesso usado no estudo: proprietário, lista pública, turma autorizada ou pasta pública/turma autorizada.
- nova migration de identidade corrige o trigger e transfere o status para o UUID retornado no unmerge.
- as migrations de sessão removem apenas a constraint conhecida `study_sessions_mode_check`; não há mais descoberta dinâmica por definição SQL, evitando apagar uma constraint não relacionada em schema divergente.
- `recordStudyProgressAttempt` virou o writer compartilhado de progresso para `Study` e `MixedStudy`; preserva cada tentativa, serializa o mesmo card durante um flush e confirma a escrita antes de removê-la do buffer.
- `MixedStudy.persistNow` foi exposto pelo hook adaptativo e é aguardado na saída, mantendo snapshot local durável mesmo quando a confirmação remota expira.
- Favoritos agora são tratados como capacidade privada: rotas públicas/anônimas degradam explicitamente para todos os cards, sem converter a ausência de favoritos em deck vazio.
- Cache offline vazio deixou de ser considerado confirmação de lista vazia; entra em recuperação sem criar sessão ou emitir toast de falso vazio.
- O engine recebe `deckReady` para não inicializar uma sessão enquanto cards/preset ainda estão sendo carregados; o Misto aceita snapshots locais v1 como fallback compatível.
- `createLatestWriteQueue` serializa atualizações de `study_sessions`, coalesce pendências que ainda não começaram e invalida filas quando muda usuário/lista/modo; os updates confirmam o id e o escopo de usuário/lista/modo, enquanto o payload converge a chave v2 estável.
- Corrigido o guard de conclusão para usar `.length` no buffer de progresso e não concluir/limpar uma sessão com respostas ainda pendentes.
- `studySessionSettingsToPresetOverride` converte o snapshot durável em overrides de sessão sem alterar o preset persistido; Study e Misto reaplicam também direção e filtro quando uma sessão legada v1 ou v2 é escolhida.
- Readiness explicita `cancelled`/`request-cancelled` e não mistura cancelamento de rota/geração com falha de carregamento.

## Limitações e rollout seguro

- As migrations `20260801153000_preserve_stable_status_identity_v1.sql` e `20260801153500_atomic_flashcard_progress_v1.sql` não foram aplicadas a `ymahldldyxvwjeruaxpr` nem a `xrnfhhoxmmstagmelvyi`.
- Nenhuma chave, Auth, RLS, dado de produção ou referência de projeto foi alterada.
- O flag de status estável permanece desligado por padrão; só deve ser promovido após migration aplicada, tipos regenerados e smoke test autenticado.
- O CLI Supabase não está disponível neste ambiente; a aplicação deve ser feita por migration revisada no fluxo administrativo do projeto correto.
- Rollback: reverter o frontend/flag; manter migrations aditivas e tabelas/colunas, sem `DROP`, limpeza manual ou restauração destrutiva.

## Evidência local desta etapa

- TypeScript: passou via runtime Node empacotado (`tsc --noEmit`).
- Testes direcionados desta etapa: 5 arquivos, 32 testes passaram.
- Suíte completa desta etapa: 205 arquivos, 1.232 testes passaram.
- ESLint: 0 erros e 68 warnings preexistentes.
- Build Vite de produção: passou, 3.895 módulos transformados; warnings existentes de CSS/chunks grandes permanecem.
- Cadeia editorial/prerender/bundle/SEO: passou; score local 100/100.
- `git diff --check`: passou.
- O arquivo gerado `supabase/functions/mcp/index.ts` foi restaurado ao estado rastreado e não faz parte do diff.

## Próxima etapa autorizada

Revisar e publicar este PR pela Lovable após aprovação. A aplicação das migrations, regeneração de tipos e testes reais de RLS/continuidade exigem revisão operacional e não devem ser automatizados por este agente.

## Evidência E2E somente leitura no preview — 2026-08-01

O inventário completo de controles e escopos está em `docs/audits/study-persistence-inventory-2026-08-01.md`; o submodo Reescrever permanece explicitamente dentro do modo Escrita.

Validação desta continuação: typecheck passou; contrato de modos, conclusão e fila de gravação — 3 arquivos, 10 testes passaram.

Foi executada uma inspeção no preview da própria branch, sem autenticação, sem submissão de formulário e sem clique em ações que possam criar sessão ou gravar progresso:

- home pública: `readyState=complete`, título/cabeçalhos esperados e nenhum warning/error de console;
- `/portal`: portal público carregado, sem alertas, sem overflow horizontal e sem warning/error de console;
- página pública de professor: carregou turmas e materiais públicos reais, com botões de entrada e contagens coerentes; nenhum warning/error de console;
- viewport móvel de 390x844 em `/portal`: conteúdo dentro da largura disponível e `horizontalOverflow=false`;
- após retornar ao viewport padrão, a página pública continuou em `readyState=complete` e sem erros registrados.

O preview apresentou ações de entrada no jogo como botões, e não como links verificáveis. Como essas ações podem iniciar uma sessão anônima ou produzir gravação remota, elas não foram acionadas nesta etapa. Portanto esta evidência não comprova os checks 26, 27 e 29: ainda falta uma execução autorizada e controlada do fluxo de jogo, com confirmação explícita de que nenhuma escrita ocorrerá em produção ou com um ambiente de teste isolado.

## Evidência da restauração de configurações e readiness — 2026-08-01

- Testes focados: `studySessionContext.test.ts` e `studySessionRuntime.test.ts`; 2 arquivos e 16 testes passaram.
- TypeScript após a implementação: passou via runtime Node empacotado.
- Build Vite após a implementação: passou com 3.895 módulos transformados.
- O build regenerou o bundle automático de `supabase/functions/mcp/index.ts`; ele foi restaurado ao conteúdo rastreado e permanece fora do diff.
- Nenhuma migration, consulta de escrita, troca de projeto, alteração de Auth/RLS ou publicação foi executada.
