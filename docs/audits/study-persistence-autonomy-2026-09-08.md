# Auditoria e implementação — persistência autônoma de estudo

## Diagnóstico

O produto já possuía presets por modo/lista, snapshots locais e sessões remotas, mas havia quatro lacunas que impediam afirmar retomada autônoma:

- o lote de respostas e a fila de gravação remota eram somente memória;
- `saveProgressNow` retornava confirmação após enfileirar, antes de drenar a fila;
- a fila era isolada por aba e não havia uma revisão aceita pelo servidor;
- o snapshot de contexto não carregava as configurações de Play, embora elas fizessem parte do preset.

Também foi verificado somente por leitura o projeto Supabase administrativo `xrnfhhoxmmstagmelvyi`: `study_sessions` existe, porém não possui `session_scope_key`, `settings_snapshot`, `session_snapshot`, `schema_version` ou `client_revision`; as tabelas de preferências e os RPCs de estudo esperados também não aparecem no schema remoto consultado. Isso não deve ser confundido com o projeto de produção `ymahldldyxvwjeruaxpr`.

## Decisão

Preservar o desenho visual e a arquitetura existente, acrescentando um write-ahead log em IndexedDB e um RPC aditivo de compare-and-set. O preset continua separado da sessão ativa:

`sessão válida > override da lista > preset global > padrão`.

Retomar uma sessão aplica overrides efêmeros apenas durante aquela sessão. Não altera o preset salvo. Uma sessão nova lê o preset vigente.

## Alterações

- `src/features/study/lib/studyPersistenceOutbox.ts`: outbox durável, escopado por usuário; snapshots de sessão são coalescidos por sessão/revisão e respostas são mantidas individualmente por `operationId`.
- `src/features/study/lib/studySessionRepository.ts`: writer RPC confirmado com fallback estreito para colunas legadas.
- `src/features/study/hooks/useStudyEngine.ts`: autosave local + outbox, replay ao abrir/voltar a rede/voltar ao app, flush antes de sair, confirmação após `drain`, revisão monotônica e respostas duráveis.
- `src/pages/MixedStudy.tsx`: uso do mesmo writer/revisão/outbox para a superfície adaptativa.
- `src/features/study/lib/studySessionContext.ts` e `studySessionSnapshot.ts`: recuperação das configurações Play e preservação dos metadados ricos no fallback local.
- `src/features/study/lib/restoreStudySession.ts`: quando a cópia local da mesma `sessionId` é mais nova, ela vence a cópia remota antiga; o reparo preserva IDs válidos e acrescenta cards novos ao final.
- `supabase/migrations/20260908120000_autonomous_study_persistence_v1.sql`: coluna `client_revision`, índice e RPC `persist_study_session_v1`, todos aditivos.

## Limites verificados

Não houve migration remota, publicação, alteração de Auth/RLS nem alteração de dados. A migration precisa ser aplicada, em ordem, no ambiente autorizado antes que a proteção CAS e as preferências remotas sejam consideradas ativas. Até lá, o app mantém o fallback local e o fallback estreito de sessão legada.

## Validação pendente

Executar typecheck, testes, lint e build nesta branch. Depois da aplicação no backend correto, validar manualmente refresh, `pagehide`, duas abas, offline/online, troca de conta, alteração de deck/camadas e os modos Flip, Write, Multiple Choice, Unscramble, Mixed (ambas as superfícies) e Pronunciation.
