# 06 — Mobile-first Layout

1. **Escopo vistoriado:** 320–430 px, desktop de referência, scroll, safe-area, barras, modais e área útil.
2. **Arquivos analisados:** layouts globais, landing, sidebar/bottom nav, dialogs, hub e estudo.
3. **Rotas analisadas:** `/`, `/auth`, home, biblioteca, hub e estudo.
4. **Evidências:** landing sem overflow horizontal, porém com cerca de 28,7 viewports em 320 px; onboarding ocupa grande parte de 390×844; controles compartilhados já alcançam 44 px em vários pontos.
5. **Problemas:** excesso de scroll vertical, risco de barras concorrentes, modais densos e ações secundárias empilhadas.
6. **Severidade:** P1 em gameplay/modal; P2 na landing.
7. **Causas:** desktop reduzido por empilhamento, pouca progressive disclosure e headers altos.
8. **Três propostas:** A) somente reduzir espaços; B) shell compacto + bottom sheets/drawers contextuais; C) telas mobile totalmente separadas.
9. **Recomendação:** B, preservando uma única árvore funcional e adaptando composição.
10. **Impacto mobile:** card/ação principal dominam; CTA fica no alcance do polegar; safe-area e teclado entram no contrato.
11. **Impacto desktop:** drawers viram painéis/popovers; densidade pode aumentar sem duplicação.
12. **Acessibilidade:** alvo de 44×44, reflow, foco não oculto por sticky e orientação livre.
13. **Performance:** CSS responsivo e componentes já existentes; evitar listeners de resize por item.
14. **Riscos:** esconder recursos importantes ou criar dupla rolagem em sheet/dialog.
15. **Testes:** 320/360/375/390/412/430, landscape, teclado virtual, iOS/Android, zoom e toque.
16. **Arquivos que mudariam:** shells, primitives responsivas, dialogs/sheets, landing, hub, estudo e testes visuais.
