---
cssclasses:
  - ape-ai-note
---

# Current State

## Snapshot
- **Projeto:** APE — App Piteco.
- **Repositório:** `PedroLuis-Ape/flash-teacher-buddy`.
- **Branch canônica:** `main`.
- **HEAD observado neste checkup:** `798acb5dccfcad8c016b8ce9b7d268dca7601d20`.
- **Mensagem do HEAD:** `Adicionou fluxo de reescrita`.
- **Publicação frontend:** Lovable.
- **Domínio canônico:** `https://www.apeeducation.org/`.

## Estado crítico atual

### 1. Reescrita acabou de receber o novo fluxo
**[VERIFICADO-REPO]**

Máquina de estados:
`LISTENING → REVIEW → REWRITE → COMPLETED`.

Contrato:
- inglês-alvo não legível durante LISTENING;
- TTS repetível;
- lado oposto/tradução visível;
- primeiro acerto conclui;
- primeiro erro revela resposta e exige reescrita;
- estado mínimo serializado para retomada;
- integração em Study e Mixed.

**[REVALIDAR]** O próprio plano/roadmap registra que a validação visual autenticada real ainda estava bloqueada por ausência de sessão acessível no preview.

### 2. Persistência de estudo é uma área de alta complexidade
**[VERIFICADO-REPO]**
O sistema combina:
- `localStorage` para snapshot imediato;
- IndexedDB para outbox durável;
- persistência remota;
- revisão/compare-and-set quando o backend suporta os RPCs novos;
- fallback legado;
- snapshots de mastery/round.

Invariante: **não persistir sessão ativa com `cards_order=[]`.**

### 3. Código moderno vs schema administrativo
**[VERIFICADO-ADMIN-DB]**
O Supabase administrativo `xrnfhhoxmmstagmelvyi` ainda mostra `study_sessions` com colunas básicas. Não foram observadas `client_revision`, `settings_snapshot`, `session_snapshot`, `session_scope_key` ou `schema_version`.

### 4. Produção e administração são ambientes diferentes
**[VERIFICADO-REPO]**
`AGENTS.md` atual:
- produção: `ymahldldyxvwjeruaxpr`
- admin/migrations/diagnóstico: `xrnfhhoxmmstagmelvyi`

A introspecção direta da produção foi negada por permissão neste checkup.

### 5. Importadores ainda precisam de QA runtime/mobile completo
**[VERIFICADO-REPO]**
Auditorias de 8–9/09 corrigiram corrida de leitura, rejeição parcial, busy state, navegação e outros pontos, mas vários fluxos continuam marcados como parciais no browser/mobile.

### 6. Glossário já possui arquitetura de camadas madura
**[VERIFICADO-REPO]**
Há suporte para palavra, expressão sobreposta, contexto do card, índices exatos, segmentos descontínuos e Unicode. A arquitetura desejada é:
**base global + contexto do card + expressão**.

### 7. Extensão Chrome está no repo
**[VERIFICADO-REPO]**
`browser-extension/ape-pronunciation-notes/`.

Manifest atual injeta `content.js` em `http://*/*` e `https://*/*`, explicando o alerta de acesso amplo da Chrome Web Store.

## Próximas prioridades
1. QA autenticado real do Rewrite em mobile.
2. Revalidar resume/persistência contra backend de produção correto.
3. Rodar polimento UI/mobile/motion com loop visual.
4. Completar QA runtime/mobile dos importadores.
5. Reduzir alcance da extensão Chrome se a arquitetura permitir.
6. Manter handoff Luna → Astra atualizado.
