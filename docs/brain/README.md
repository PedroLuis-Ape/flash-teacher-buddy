---
category: documentation
cssclasses:
  - ape-ai-note
type: canonical-vault
status: active
area: knowledge-management
last_reviewed: 2026-09-16
related:
  - "[[00-HOME]]"
  - "[[10-CONTEXT-FEEDING-RULE]]"
  - "[[01-CURRENT-STATE]]"
  - "[[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]]"
  - "[[learning/00-LEARNING-HUB]]"
  - "[[areas/adaptive-learning]]"
---

# Segundo Cérebro do App Piteco

Este é o espelho versionado e sincronizado do App Piteco. A entrada operacional
oficial do Obsidian fica em `C:\Users\pedro\Documents\App-Piteco-Brain`. A cópia
em `docs/brain/` preserva decisões, contratos, riscos, evidências e handoffs que
sejam caros de reconstruir; não é diário de execução nem substituto do código.

## Fontes de verdade

- Git e o código atual são a fonte de verdade da implementação.
- O backend correto é a fonte de verdade de dados/schema quando a tarefa toca persistência.
- Testes e runtime são a evidência de comportamento executado.
- O vault externo é a entrada operacional oficial do Obsidian; `docs/brain/` é o espelho versionado.
- Memória antiga que conflita com código, banco ou runtime precisa ser revalidada; não vence a realidade atual.

## Uso condicional — não obrigatório

As Skills `piteco-second-brain-protocol` e `piteco-adaptive-learning-loop` estão disponíveis, mas são
**condicionais e seletivas**. Tarefa simples/local normalmente não consulta nem grava o Segundo Cérebro.
Não existe preflight universal, nem obrigação de abrir `01-CURRENT-STATE`, `learning/` ou qualquer nota
só porque o trabalho é do App Piteco.

Quando contexto histórico puder mudar materialmente a decisão, a entrada é
[[10-CONTEXT-FEEDING-RULE|START HERE — Protocolo de contexto]]. A partir daí:

1. buscar primeiro e ler somente uma ou poucas notas/trechos relevantes;
2. parar assim que houver contexto suficiente;
3. comparar memória com código/Git atual;
4. criar Context Packet apenas quando o mesmo contexto será reutilizado por dois ou mais atores/etapas;
5. usar `piteco-adaptive-learning-loop` somente quando houver valor real de aprendizado durável, como
   falha repetida, resultado surpreendente, incidente relevante ou retrospectiva de mudança arriscada;
6. registrar de volta somente decisão, contrato, risco, causa-raiz, teste ou handoff durável.

Ausência de leitura ou escrita de memória é um resultado normal e esperado.

## Coordenação com agentes

A política vigente é **MAIN FIRST / zero subagentes por padrão**. CLARA Brain, Explorer, Worker e
Reviewer são papéis sob demanda, não uma cadeia obrigatória. Delegado que recebe resumo/packet válido
não refaz preflight do Brain nem reconstrói histórico por precaução. Ver [[05-AGENTS]] e [[04-DECISIONS]].

## Manutenção

Rode `npm run brain:check` quando `docs/brain/` tiver sido alterado. Não execute o checker nem crie log
de sessão apenas para encerrar uma tarefa que não mudou a memória. O material em `imports/` permanece
histórico e não é reescrito para satisfazer validação da memória ativa.

A aparência e a classe `ape-ai-note` permanecem preservadas para manter as anotações do agente em
vermelho no Obsidian. Mudanças materiais entre o vault externo e `docs/brain/` devem ser reconciliadas,
sem criar duas explicações concorrentes.
