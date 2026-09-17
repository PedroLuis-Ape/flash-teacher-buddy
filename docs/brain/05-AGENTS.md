---
category: agent
area: codex
status: active
cssclasses:
  - ape-ai-note
---

# Agentes e coordenação

## Política vigente — 2026-09-16

`[DECISION]` A MAIN trabalha primeiro. **Zero subagentes é o padrão**; delegação só acontece quando
uma divisão real de trabalho melhora materialmente qualidade, independência ou tempo.

`[DECISION]` As Skills `piteco-second-brain-protocol` e `piteco-adaptive-learning-loop` são
**condicionais e seletivas**, não obrigatórias. Em tarefa simples/local, não há preflight, leitura nem
fechamento do Segundo Cérebro. A política canônica é
`C:\Users\pedro\.codex\policies\second-brain-policy.md`.

`[DECISION]` Os papéis CLARA continuam disponíveis — `clara_brain`, `clara_explorer`,
`clara_worker`, `clara_reviewer` — mas são **papéis sob demanda, não um pipeline obrigatório**.
Não existe mais obrigação de executar Brain → Explorer → Worker → Reviewer → Brain.

- `clara_brain`: somente quando contexto histórico/memória pode mudar a decisão.
- `clara_explorer`: somente quando o escopo/código relevante ainda precisa ser descoberto.
- `clara_worker`: somente quando existe implementação separável que vale delegar.
- `clara_reviewer`: somente para mudança ampla/arriscada/contratual ou quando revisão independente
  trouxer ganho material.

`[DECISION]` Delegação aninhada/recursiva é proibida por padrão. Tarefa média usa no máximo um
subagente quando necessário; tarefa complexa/alto risco usa até dois por padrão. Um delegado recebe
objetivo, restrições, arquivos/trechos relevantes e resumo/Context Packet compacto quando houver;
não refaz o preflight inteiro nem recebe histórico completo sem necessidade.

`[DECISION]` Luna segue como modelo econômico preferido para subagentes, porém a regra global
`reasoning_effort = high` para qualquer papel está **substituída**. Esforço deve acompanhar a tarefa:
memória/exploração mecânica em baixo ou médio; worker/reviewer em médio por padrão; High somente
quando complexidade ou risco justificarem. Sem `xhigh`, `ultra` ou escalonamento automático caro.

`[DECISION]` Gates são proporcionais e consolidados pela MAIN. Subagentes executam checks focados e
não repetem automaticamente `typecheck`, `test`, `lint`, `build`, `brain:check` ou validações já
cobertas no mesmo estado do código.

## Repositório e memória

Git/código atual é a fonte canônica da implementação. `docs/brain/` é memória operacional durável,
não diário de cada execução. Não criar notas, commits ou relatórios só para o agente se lembrar do
trabalho realizado. Atualização de memória só ocorre quando um contrato, decisão, risco ou contexto
durável realmente mudou.

Histórico Git/PR e scans amplos também são sob demanda: não clonar, reler PRs recentes, varrer árvore
inteira ou consultar `git log` apenas por precaução quando checkout/código atual já responde à tarefa.

## Contexto adaptativo e CCL

A representação adaptativa continua: **NATURAL**, **NATURAL_SHORT**, **CCL_L1**, **CCL_L2** conforme
o estado do contexto. CCL v3 permanece congelado. Retrieval é seletivo; contexto conhecido e ainda
válido não é retransmitido (REFERENCE + DELTA). Context Packet existe quando haverá reutilização real
entre atores; tarefa resolvida somente pela MAIN não cria packet por ritual.

Ver [[27-CONTEXT-PACKET-E-TELEMETRIA]] e [[10-CONTEXT-FEEDING-RULE]].

## Histórico substituído

`[SUBSTITUIDA]` A configuração de 2026-09-14 tratava o time CLARA como fluxo padrão obrigatório e
fixava todos os subagentes em Luna + High. Essa decisão foi substituída pela política demand-driven
acima após evidência de overhead excessivo de contexto/delegação.

`[HISTORICO]` A decisão de 2026-09-12 fixava as Claras em DeepSeek
`deepseek/deepseek-v4-flash` + `ultra`; continua substituída.

## Limites operacionais preservados

- nunca trabalhar diretamente em `main`;
- escopos de escrita disjuntos quando houver mais de um ator;
- sem Supabase/Auth/dados de produção em subagente sem tarefa explícita e rollback;
- agente concluído é encerrado antes de abrir outro;
- alterações e testes devem ser informados de forma compacta, sem relatório narrativo desnecessário.

Related: [[04-DECISIONS]] · [[10-CONTEXT-FEEDING-RULE]] · [[25-CCL-REGISTRY]] · [[27-CONTEXT-PACKET-E-TELEMETRIA]]
