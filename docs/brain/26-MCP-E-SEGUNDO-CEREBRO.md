---
category: agent
area: mcp
cssclasses:
  - ape-ai-note
type: rule
domain: arquitetura
status: active
priority: high
last_reviewed: 2026-09-13
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[03-ARCHITECTURE]]"
  - "[[04-DECISIONS]]"
  - "[[10-CONTEXT-FEEDING-RULE]]"
  - "[[areas/mcp-agent-api]]"
  - "[[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]]"
---

# MCP e Segundo Cerebro — fronteira permanente

> Regra estrutural do projeto. Vale para todo agente que opera o Piteco pelo
> MCP.

## Regra principal

**Segundo Cerebro = contexto duravel.**
**MCP = estado real atual + acoes.**

Nao confundir os dois, nao usar um como substituto do outro.

## O que pertence ao Segundo Cerebro

Conhecimento relativamente estavel: regras de produto, decisoes
arquiteturais, semantica dos dominios, funcionamento de instituicoes,
significado de pastas/listas/cards, preferencias operacionais do Pedro,
metodologia de estudo, convencoes, politicas linguisticas, regras de
seguranca, comportamentos esperados do MCP, erros conhecidos.

Exemplos duraveis:

- biblioteca pessoal e instituicao sao escopos diferentes;
- function words muito basicas normalmente nao entram na descoberta de
  vocabulario;
- phrasal verbs nao devem ser destruidos por normalizacao;
- o agente pode editar profundamente listas quando autorizado;
- operacoes grandes tem preview quando ha risco material.

## O que pertence ao MCP (tempo real)

Quais pastas existem agora, quais listas, quais cards, nomes e IDs atuais,
instituicao atual, memberships e permissoes atuais, conteudo de uma lista,
contagem de cards, estado da lixeira, ordem, e o resultado das alteracoes
feitas.

**Nunca usar memoria antiga como substituta de consulta ao MCP.**

## Hierarquia de verdade

| Pergunta | Fonte vencedora |
| --- | --- |
| Estado de dados agora | MCP / sistema vivo |
| Schema e contratos tecnicos | codigo e migrations atuais |
| Decisoes, intencao e regras duraveis | Segundo Cerebro canonico |

Se o Brain diz "a lista X esta na pasta Y" e o MCP mostra outro lugar, isso
**nao e automaticamente erro**: o Pedro pode ter movido depois. O MCP vence
para estado atual.

## Quando consultar o Brain

Retrieval **seletivo**, quando o contexto puder alterar materialmente a
decisao:

- "crie uma pasta chamada X" -> provavelmente nao precisa carregar contexto;
- "analise este texto e escolha o vocabulario que vale a pena estudar" ->
  contexto linguistico/metodologico importa;
- "organize toda minha biblioteca" -> consultar convencoes antes de alterar
  centenas de objetos;
- "crie material para uma instituicao" -> carregar regras de instituicao/role.

## Nao bloquear acao por memoria

O Brain melhora decisoes; nao transforma tarefa trivial em cerimonia. Se a
acao e simples, explicita e segura: execute. O Brain **nao** e dependencia
critica da integridade dos dados — se estiver indisponivel, o MCP continua
operando corretamente.

## Aprendizado durante operacoes

Uma regra duravel nova ("Pedro sempre quer X neste tipo de comparacao") pode
virar candidata a atualizacao deste vault. **Nao** registrar como regra:
IDs temporarios, contagens, nomes que mudam, estado atual da biblioteca ou o
resultado isolado de uma operacao.

## Fluxo alvo

USUARIO -> AGENTE -> recupera contexto duravel relevante do Segundo Cerebro
(quando necessario) -> consulta estado atual pelo MCP -> raciocina -> executa
pelo MCP -> valida pelo MCP -> responde.

Formalmente: **CONTEXT + LIVE STATE + USER INTENT = ACTION**.

Ver tambem [[areas/mcp-agent-api]] e [[10-CONTEXT-FEEDING-RULE]].
