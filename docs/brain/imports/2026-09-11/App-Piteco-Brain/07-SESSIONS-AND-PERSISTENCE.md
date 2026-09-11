---
cssclasses:
  - ape-ai-note
---

# Sessions and Persistence

## Objetivo
**[DECISÃO]**
Sair de uma atividade e voltar deve restaurar o mesmo jogo, mesma ordem, mesmo card e estado específico do modo.

## Preset ≠ sessão
- **Preset:** como o usuário normalmente quer jogar.
- **Sessão:** estado exato da partida em andamento.

Ao retomar sessão antiga, snapshot da sessão vence preset atual. Sessão antiga não deve sobrescrever um preset mais novo.

## Camadas atuais
**[VERIFICADO-REPO]**

### localStorage
`studySessionSnapshot.ts`
- snapshot versão 2;
- sessionId/currentIndex/cardsOrder/results/timestamp;
- settings/mastery/round/unseen/missed/isFinished/layer opcionais;
- não grava snapshot com ordem vazia.

### IndexedDB
`studyPersistenceOutbox.ts`
DB `ape-study-persistence`.
Stores:
- `session_snapshots`
- `progress_events`.

Snapshots são coalescidos por identidade/revisão; eventos de resposta não são coalescidos.

### Supabase
`studySessionRepository.ts`
- tenta `claim_study_session_v1`;
- tenta `persist_study_session_v1`;
- caminho moderno usa revisão/compare-and-set;
- caminho legado faz fallback para colunas básicas.

## ST-empty-order
**[HISTÓRICO + contrato atual confirmado]**
Erro de retomada já ocorreu com identificador `ST-empty-order`.
O runtime atual trata ordem vazia como recovery/failure, e houve commit específico para restaurar requested sessions sem fila vazia.

## Invariantes
- nunca persistir sessão ativa com `cards_order=[]`;
- não rerandomizar resume;
- não resetar index silenciosamente;
- double submit não avança duas vezes;
- último card conclui corretamente;
- round/mastery preservados;
- local é fallback rápido;
- remoto é durável;
- writer antigo não vence writer novo;
- cards removidos do deck precisam de reconciliação consciente.

## Auditoria 09/09
**[VERIFICADO-REPO]**
Corrigiu:
- save explícito perdendo conclusão/rodada;
- Mixed perdendo tentativa após falha remota;
- requeue ressuscitando cópia antiga;
- sinalização de conflito de revisão.

Pendências registradas:
- reconciliação interativa de conflito;
- comprovação de persistência em produção;
- divergência de schema/RPC.

## Testes obrigatórios
- card N → sair → voltar N;
- refresh;
- fechar aba;
- offline→online;
- duas abas;
- último card;
- deck alterado;
- empty order;
- sessão concluída;
- random;
- mastery;
- mixed;
- Rewrite LISTENING/REWRITE;
- double submit.
