# 14 — Accessibility

1. **Escopo vistoriado:** contraste, foco, teclado, labels, ARIA, zoom, reflow, targets, motion, modais e autenticação.
2. **Arquivos analisados:** primitives, home, navegação, landing/auth, dialogs, hub e estudo.
3. **Rotas analisadas:** pública, privada, gameplay e classroom.
4. **Evidências:** bons targets em componentes compartilhados e alguns estados de foco/reduced motion; cards clicáveis não semânticos, menu sem nome, ação hover-only e ausência de skip link.
5. **Problemas:** semântica, foco, contraste e discoverability.
6. **Severidade:** P1.
7. **Causas:** interação atribuída a containers visuais e estados baseados em hover/cor.
8. **Três propostas:** A) auditoria ao final; B) contrato acessível em cada primitive e gate por onda; C) overlay/plugin corretivo.
9. **Recomendação:** B; acessibilidade é requisito de componente e poder de veto.
10. **Impacto mobile:** targets 44 px, foco visível, reflow e CTA não oculto.
11. **Impacto desktop:** teclado completo, hover não exclusivo e skip navigation.
12. **Acessibilidade:** WCAG 2.2 AA integral como gate; AAA onde mensurável, inclusive 7:1 e 44×44 no Playful.
13. **Performance:** sem overlay; sem custo de runtime significativo.
14. **Riscos:** ARIA substituindo semântica nativa, focus trap quebrado ou visual bonito porém inacessível.
15. **Testes:** axe, teclado manual, leitor de tela, zoom 200/400, forced colors, reduced motion e contrast matrix.
16. **Arquivos que mudariam:** primitives, navegação, cards, dialogs, auth, estudo e suíte de acessibilidade.
