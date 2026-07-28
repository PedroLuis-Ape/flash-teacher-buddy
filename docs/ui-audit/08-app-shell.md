# 08 — App Shell and Navigation

1. **Escopo vistoriado:** header, sidebar, bottom nav, home, biblioteca, pastas, listas, metas, loja, perfil, notificações e back navigation.
2. **Arquivos analisados:** layouts privados, navegação, cards de home, menus, headers e primitives.
3. **Rotas analisadas:** portal/home, biblioteca, pastas/listas, metas, loja e perfil.
4. **Evidências:** shell compartilha CSS global; cards clicáveis nem sempre são elementos semânticos; menu lateral possui lacunas de nome acessível; ações destrutivas podem depender de hover.
5. **Problemas:** seleção pouco firme, navegação duplicável, ações invisíveis no touch e desperdício vertical.
6. **Severidade:** P1.
7. **Causas:** componentes visuais genéricos sem contrato de interação e adaptações mobile locais.
8. **Três propostas:** A) recolorir shell; B) primitives semânticas + navegação adaptativa; C) novo shell separado por estilo.
9. **Recomendação:** B; mesma estrutura funcional para todos os estilos.
10. **Impacto mobile:** bottom nav segura, header curto, ações de item sempre descobríveis e drawers.
11. **Impacto desktop:** sidebar compacta, estados selecionados fortes e conteúdo mais amplo.
12. **Acessibilidade:** links/botões reais, nomes acessíveis, foco, skip link, roving focus quando necessário.
13. **Performance:** sem duplicar árvores nem montar duas navegações simultaneamente.
14. **Riscos:** divergência entre desktop/mobile e seletores globais vazando para gameplay.
15. **Testes:** teclado, touch, safe-area, rota selecionada, nomes longos, badges, duas abas e regressão de estilos antigos.
16. **Arquivos que mudariam:** layouts, componentes de navegação/home/listas, primitives e testes.
