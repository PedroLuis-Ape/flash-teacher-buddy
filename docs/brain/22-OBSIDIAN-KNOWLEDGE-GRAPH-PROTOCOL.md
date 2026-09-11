---
cssclasses:
  - ape-ai-note
type: protocol
status: active
area: knowledge-management
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[04-DECISIONS]]"
  - "[[06-BUGS]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[12-PROCESS-LOG-2026-09-11]]"
  - "[[README]]"
  - "[[areas/adaptive-learning]]"
---

# Protocolo do grafo de conhecimento do App Piteco

O segundo cérebro é uma rede de conhecimento, não uma coleção de arquivos isolados. O ponto de entrada é [[00-HOME]]; o mapa factual é [[01-CURRENT-STATE]]; detalhes devem permanecer nas notas de área, decisão, bug, risco, teste e sessão.

## Regras operacionais

- Criar links internos para uma nota existente sempre que a relação ajudar a entender causa, consequência, contexto, decisão, implementação, risco, teste ou retomada.
- Usar links para relações semânticas e tags apenas para classificação ampla.
- Toda nota importante deve ter uma entrada conceitual e uma saída relevante, salvo isolamento intencional.
- Session logs devem apontar para a área trabalhada, bugs, decisões, arquitetura, testes e handoff.
- [[01-CURRENT-STATE]] deve continuar curto e apontar para notas profundas, sem duplicar todo o conhecimento.
- Antes de alterar uma decisão ou arquitetura, consultar os backlinks e os riscos relacionados.
- Ao renomear notas, preservar os wikilinks e evitar operações cegas que deixem referências quebradas.

## Checklist de encerramento

1. A informação está na nota correta?
2. As áreas e decisões relacionadas estão conectadas?
3. Bugs possuem área e causa-raiz quando conhecidas?
4. O log da sessão aponta para o trabalho real?
5. [[01-CURRENT-STATE]] aponta para o estado atual sem absorver o histórico?
