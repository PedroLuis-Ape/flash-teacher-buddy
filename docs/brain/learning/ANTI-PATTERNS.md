---
cssclasses:
  - ape-ai-note
type: anti-pattern-index
status: active
area: adaptive-learning
related:
  - "[[learning/00-LEARNING-HUB]]"
  - "[[areas/adaptive-learning]]"
  - "[[08-RISKS]]"
---

# Anti-patterns

Não promover um anti-pattern sem tentação recorrente, modo de falha e
alternativa apoiada por evidência.

## AP-014 — Não corrigir ordenação de persistência com atraso arbitrário

### Tentação

Adicionar um `setTimeout` fixo antes de salvar ou restaurar uma sessão porque
o race condition desaparece localmente.

### Por que parece razoável

O atraso muda o agendamento o suficiente para mascarar o problema em uma
combinação específica de dispositivo e rede.

### Modo de falha

Ele não estabelece propriedade, revisão nem ordem de conclusão. O bug pode
voltar em dispositivos, abas ou redes com timing diferente.

### Preferir

Revisão explícita, fila, fronteira de conclusão, ownership, compare-and-set e
idempotência, conforme o contrato real de [[01-CURRENT-STATE]].

### Escopo

Problemas de sessão, persistência e concorrência. Não aplicar automaticamente
a animações ou atrasos que sejam parte explícita da experiência do usuário.

### Relacionado

[[areas/adaptive-learning]] · [[08-RISKS]] · [[learning/00-LEARNING-HUB]]
