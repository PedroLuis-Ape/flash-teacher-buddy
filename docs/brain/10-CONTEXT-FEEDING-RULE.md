---
category: documentation
cssclasses:
  - ape-ai-note
aliases:
  - START-HERE
  - PROTOCOLO-DE-CONTEXTO
type: protocol
status: active
area: knowledge-management
last_reviewed: 2026-09-16
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[04-DECISIONS]]"
  - "[[06-BUGS]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[27-CONTEXT-PACKET-E-TELEMETRIA]]"
---

# START HERE — Protocolo de contexto do App Piteco

Política canônica (fonte única): `C:\Users\pedro\.codex\policies\second-brain-policy.md`.
Este documento só explica a rota do Brain do Piteco; não transforma memória em etapa obrigatória.

## Regra principal

**Resolver primeiro com o contexto já disponível e com o código atual.** O Segundo Cérebro entra
somente quando informação histórica/persistente puder mudar materialmente a decisão.

### Níveis

- **0 — simples/local:** texto, CSS, tipagem, lint, teste localizado, erro evidente, pequena edição em
  arquivo conhecido. Não consultar nem gravar memória. Não criar Context Packet.
- **1 — normal:** começar pelo código. Se necessário, consultar no máximo o índice [[00-HOME]]; não
  seguir links automaticamente.
- **2 — sistêmico:** persistência, flashcards, auth, importação, banco, arquitetura, progresso,
  gamificação ou contrato compartilhado. Índice → uma ou poucas notas diretamente relevantes → parar
  assim que houver contexto suficiente.
- **3 — histórico:** regressão dependente de histórico, decisão arquitetural antiga, contradição ou
  retomada. Busca direcionada por termo/trecho; nunca varredura do vault.

## Limites de leitura

- busca antes de leitura;
- nunca ler o vault inteiro nem seguir referências recursivamente por reflexo;
- nota grande é lida por trecho;
- de [[01-CURRENT-STATE]], preferir apenas o bloco **FECHAMENTOS** mais recente quando estado/retomada
  for realmente necessário;
- `docs/brain/brain-manifest.json` é artefato derivado e grande: consultar por filtro, nunca despejar no
  contexto;
- notas históricas em `imports/` só entram quando o núcleo específico da tarefa exigir revalidação;
- código/Git atual, backend real, testes e runtime vencem memória antiga não revalidada.

O vault operacional externo é `C:\Users\pedro\Documents\App-Piteco-Brain`; `docs/brain/` é seu espelho
versionado. Não criar uma segunda memória independente.

## Context Packet — somente quando há reutilização real

READ ONCE → COMPACT → SHARE → REUSE existe para evitar que vários atores releiam o Brain.

**Não criar packet por ritual.** Se a MAIN resolver a tarefa sozinha, a leitura seletiva que foi
necessária pode permanecer na própria execução. Packet é indicado quando o mesmo contexto recuperado
será reutilizado por **dois ou mais atores/etapas**.

Quando aplicável:

1. **READ ONCE:** MAIN recupera apenas as notas/trechos necessários.
2. **COMPACT:** cria um packet curto com objetivo, regras, contratos, decisões, riscos, arquivos,
   invariantes, incertezas e ponteiros/hash; não copia as notas.
3. **SHARE:** o mesmo packet vai aos atores seguintes.
4. **REUSE:** quem recebeu packet válido não refaz preflight.

Invalidar/rebasear somente por mudança material no objetivo, domínio ou nota referenciada. Drift em
nota não referenciada não exige reconstrução. Lacuna pontual = ler **uma** nota/trecho + patch, nunca
reler o vault inteiro.

Comandos e telemetria: [[27-CONTEXT-PACKET-E-TELEMETRIA]].

## Delegação e memória

- `clara_brain` só é aberta quando memória pode alterar a solução.
- Worker/reviewer que receberam resumo/packet não reabrem o Brain “para confirmar”.
- Não existe obrigação de Brain → Explorer → Worker → Reviewer → Brain.
- Subagente não consulta histórico Git/PR nem Brain por precaução se o pai já forneceu o contexto
  relevante.

## O que registrar

Somente conhecimento durável e caro de reconstruir, por exemplo:

- causa-raiz demonstrada e condição de reprodução;
- decisão técnica cuja razão importa no futuro;
- mudança de arquitetura ou limite de responsabilidade;
- contrato de identidade, estado, persistência, migration, RPC ou RLS;
- risco, incompatibilidade ou bloqueio ainda relevante;
- teste que protege comportamento importante;
- handoff/estado necessário para retomada futura.

Separar fato de hipótese e marcar histórico não revalidado como tal.

## O que NÃO registrar

Não transformar o Brain em:

- log de commits;
- diário passo a passo;
- cópia de conversa;
- cópia de arquivo-fonte;
- relatório de toda tarefa;
- depósito de tentativas descartadas;
- informação que pode ser recuperada trivialmente do código atual.

GitHub também não é extensão do Brain: não criar arquivos/commits apenas para memória do agente.

## Fechamento — exceção, não obrigação

**Não atualizar memória é o resultado normal.** Só atualizar quando a tarefa mudou ou descobriu
conhecimento durável que uma execução futura precisará recuperar.

Quando houver mudança durável:

1. atualizar a nota-fonte existente, se houver;
2. criar decisão/bug/risco/checkpoint apenas se não houver fonte adequada;
3. conectar por wikilinks somente relações úteis;
4. atualizar [[01-CURRENT-STATE]] apenas se o estado de retomada realmente mudou;
5. registrar teste/risco na nota correspondente quando material;
6. corrigir informação antiga contraditória em vez de empilhar versões incompatíveis.

Rodar `npm run brain:check` quando `docs/brain/` foi alterado. Telemetria de contexto só é registrada
para tarefa que realmente usou o protocolo; nível 0/1 não precisa produzir evento apenas para dizer
que nada foi lido.

## Rotas seletivas

Quando realmente necessárias:

- arquitetura/decisão → [[03-ARCHITECTURE]] → [[04-DECISIONS]];
- bug/regressão → [[06-BUGS]] → [[08-RISKS]] → [[07-TESTS]];
- retomada → último fechamento de [[01-CURRENT-STATE]] e checkpoint específico;
- banco/persistência → [[areas/supabase-runtime]];
- aprendizado de processo → [[areas/adaptive-learning]].

Não percorrer a rota inteira se uma única nota/trecho já respondeu à pergunta.

## Fontes de verdade

- Git e código atual: implementação.
- Backend correto: dados/schema quando a tarefa toca persistência.
- Testes e runtime: comportamento executado.
- Brain: intenção, decisões, riscos e continuidade durável, sempre subordinado às fontes acima quando
  houver conflito.

## Critério final

> **Puxe apenas o contexto capaz de mudar a decisão atual. Compartilhe-o somente quando houver
> reutilização real. Grave de volta somente conhecimento durável.**

Related: [[00-HOME]] · [[04-DECISIONS]] · [[05-AGENTS]] · [[06-BUGS]] · [[07-TESTS]] · [[08-RISKS]] · [[27-CONTEXT-PACKET-E-TELEMETRIA]]
