# 12 — Motion and Microinteraction

1. **Escopo vistoriado:** pressed, hover, seleção, modal, troca de card, feedback, progresso e conclusão.
2. **Arquivos analisados:** CSS global, primitives, modais, navegação e estudo.
3. **Rotas analisadas:** todas as superfícies por ser preocupação transversal.
4. **Evidências:** há reduced-motion do sistema e preferência interna, mas parte da aplicação ocorre após o primeiro efeito; não existe escala única de duração/easing.
5. **Problemas:** risco de primeiro frame animado, movimento inconsistente e animações globais.
6. **Severidade:** P1 para reduced motion; P2 para consistência.
7. **Causas:** transições locais e preferência aplicada tarde.
8. **Três propostas:** A) biblioteca de motion; B) tokens CSS/WAAPI e boot antecipado; C) remover quase todo movimento.
9. **Recomendação:** B, com movimento funcional curto e opção efetiva desde o primeiro frame.
10. **Impacto mobile:** pressed imediato, transições curtas e nada bloqueando toque.
11. **Impacto desktop:** hover complementa, nunca substitui foco/pressed.
12. **Acessibilidade:** `prefers-reduced-motion`, preferência interna, sem flashes e equivalência estática.
13. **Performance:** transform/opacity quando apropriado; sem loops permanentes ou layout thrashing.
14. **Riscos:** salvar estado após animação, jank em listas e motion sickness.
15. **Testes:** reduced motion antes do React, long tasks, spam de clique, navegação rápida e troca de estilo.
16. **Arquivos que mudariam:** boot visual, tokens de motion, primitives e testes.
