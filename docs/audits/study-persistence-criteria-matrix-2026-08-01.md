# Matriz de conclusão da auditoria de persistência e estabilidade — 2026-08-01

Esta matriz é o controle de saída da especificação de 30 critérios. `Código` significa que há implementação e teste local correspondente; `Parcial` significa que ainda há uma lacuna arquitetural ou operacional; `Não verificado` significa que falta execução autenticada no runtime autorizado. A meta geral permanece aberta enquanto existir qualquer item parcial ou não verificado.

| # | Critério | Estado atual | Evidência principal | Lacuna restante |
|---:|---|---|---|---|
| 1 | Responsabilidades harmônicas e estado sem controladores concorrentes | Parcial | `useStudyEngine`, `studySessionFlow`, `studyDeckLoader` | `MixedStudy` ainda possui hook de sessão próprio. |
| 2 | Fonte de verdade por domínio | Parcial | `studyMode`, `studyPreset`, `studySessionContext`, relatórios da auditoria | Falta validar todos os domínios listados em runtime e consolidar o inventário fora do estudo. |
| 3 | Núcleo compartilhado em todos os modos | Parcial | loader e fluxo compartilhados; `Study.tsx` usa `useStudyEngine` | O Misto usa `useAdaptiveMixedSession`; a unificação completa ainda não foi feita. |
| 4 | Lista com cards nunca apresentada falsamente vazia | Código | `studyDeckLoader.test.ts`, confirmação de vazio e `StudyDeckEmptyState` | Falta prova com a lista real no ambiente de produção. |
| 5 | Sem reentradas repetidas para fazer cards aparecerem | Parcial | retry limitado e readiness guard | Falta fluxo E2E repetido com autenticação e rede lenta. |
| 6 | Estados loading/auth/retry/ready/empty/falha/cancelamento distintos | Parcial | `studySessionRuntime`, `StudySessionRecovery`, `StudyDeckEmptyState` | O runtime não possui ainda uma máquina E2E comprovada para todos os estados. |
| 7 | Array vazio transitório não vira vazio de negócio | Código | confirmações abortáveis em `studyDeckLoader` e testes | Falta teste autenticado contra resposta transitória real. |
| 8 | Preset individual por modo | Código | `STUDY_PRESET_MODES`, `useStudyPreferences`, testes de preferências | Falta verificar persistência remota no projeto autorizado. |
| 9 | Alteração de um modo não altera outro | Código | chaves `user_id + game_mode` e testes de cache/repositório | Falta teste entre duas contas no runtime. |
| 10 | Novo jogo usa o último preset do modo | Código | resolução global/lista/sessão no hook de preferências | Falta confirmação com dados reais após reload. |
| 11 | Restauração exata de sessão e configurações | Parcial | snapshots v2, `settings_snapshot`, `studySessionContext` | Falta teste runtime de todos os campos enumerados. |
| 12 | Isolamento por usuário + lista/escopo + modo | Parcial | `claim_study_session_v1`, chaves locais e filtros de sessão | RPC/migration ainda não foram aplicados; produção não foi inspecionada. |
| 13 | Nenhum estado de usuário aparece para outro | Parcial | chaves locais com `userId`, RLS documentado | Falta teste autenticado de duas contas. |
| 14 | Nenhuma lista contamina outra | Parcial | `buildStudySnapshotKey`, escopo de sessão e sanitização | Falta teste de navegação entre duas listas reais. |
| 15 | Nenhum modo restaura outro modo | Código | modo canônico, `sessionScopeKey`, `initKey` e testes de contexto | Falta prova com rows remotas autorizadas. |
| 16 | Camadas preservam grupo, card jogável, camada, favoritos, Foco Vermelho e progresso | Parcial | `studyLayerSnapshot`, `resolveStudyAnswerIdentity`, `prepareLayeredStudyDeck` | Falta E2E em todos os modos e schema remoto aplicado. |
| 17 | Listas modificadas e snapshots antigos são reparados | Código local | `sanitizePersistedStudyOrder`, `repairAdaptiveMixedState`, testes de reparo | Falta validar alterações concorrentes no runtime. |
| 18 | Respostas antigas não sobrescrevem novas | Parcial | gerações de loader, `latestWriteQueue`, persistência mais nova | Falta teste de rede real com respostas fora de ordem. |
| 19 | Requests canceladas ou de outro contexto são descartadas | Parcial | AbortController, gerações, timeout e claim cancellation | Algumas gravações antigas dependem de escopo de update; falta prova E2E. |
| 20 | Refresh de autenticação não cria falso vazio nem perde sessão | Parcial | `AuthContext` como fonte única e guards de acesso | Falta execução durante renovação de token. |
| 21 | Nenhuma sessão nasce com `cards_order` vazio | Código local | validação do claim, `claimStudySession` e testes de contrato | Migration/RPC ainda não aplicados no ambiente administrativo. |
| 22 | Precedência React/URL/Query/localStorage/snapshot/banco documentada | Código/documentado | `studySessionContext`, comentários do engine e relatórios | Falta revisar precedência para todos os fluxos fora de Study/Mixed. |
| 23 | Sem retry/spinner infinito, redirect falso, restart silencioso, perda/duplicação | Parcial | watchdogs, recovery UI, filas e claim serializado | Falta matriz E2E de falhas e reload. |
| 24 | Fluxos duplicados substituídos gradualmente por módulos testáveis | Parcial | loader, repositories, `studySessionFlow`, `latestWriteQueue` | `MixedStudy` ainda mantém persistência/estado especializado. |
| 25 | Legado removido após migração segura | Parcial | fallback compatível é explícito e documentado | Não pode ser removido antes da migration/RPC e do período de observação. |
| 26 | Desktop/mobile/rede lenta/reload/reabertura/logout/token/listas/turmas/coleções | Não verificado | testes estáticos e smoke público não cobrem a matriz autenticada | Falta execução manual/E2E em ambiente autorizado. |
| 27 | Sete modos validados | Parcial | contratos e testes de núcleo para modos canônicos | Falta percurso runtime completo para Flip, Escrita, Reescrever, Múltipla, Organizar, Misto e Pronúncia. |
| 28 | Auditoria, causas, arquitetura, unit/contract/integration/E2E, evidências e rollback | Parcial | relatórios em `docs/audits/`, 1.237 testes e migrations aditivas | E2E autenticado e execução do rollback ainda não existem. |
| 29 | Fluxo repetido Hub → jogo → card → jogar → sair → retornar | Não verificado | nenhuma execução runtime persistida nesta auditoria | Requer sessão autenticada e dados de teste reais/isolados. |
| 30 | Não declarar conclusão apenas por lint/typecheck/testes antigos | Atendido como controle | esta matriz mantém a meta aberta e lista os bloqueios | O objetivo só fecha após os itens acima terem evidência operacional. |

## Evidência de ambiente

- O projeto administrativo `xrnfhhoxmmstagmelvyi` respondeu saudável em leitura, mas sua lista de migrations termina antes das migrations aditivas de persistência e os RPCs de claim/progress ainda não estão presentes.
- O backend de produção `ymahldldyxvwjeruaxpr` não liberou leitura de metadata pelo conector; nenhum dado foi criado para compensar essa ausência.
- Nenhuma migration, grant, policy, Auth, sessão ou dado remoto foi alterado durante esta auditoria.

## Plano de saída e rollback

1. Revisar as migrations aditivas no PR e obter backup/rollback operacional.
2. Aplicar somente no projeto canônico autorizado, regenerar tipos e consultar os RPCs.
3. Executar a matriz autenticada de duas contas, duas abas, reload, offline/online, mobile, turmas, coleções e os sete modos.
4. Se houver regressão, desativar a feature avançada por flag e manter o fallback compatível; não remover colunas nem apagar rows legadas.
