# 05 — Color and Contrast

1. **Escopo vistoriado:** cores semânticas, estados, light/dark, seleção, feedback, XP, PiteCOIN, foco e disabled.
2. **Arquivos analisados:** tokens CSS, paletas, botões, badges, feedback de estudo, gamificação e auth.
3. **Rotas analisadas:** públicas, shell, loja, metas, hub, estudo e turmas.
4. **Evidências:** amostras atuais de verde/glow ficam abaixo do alvo AAA e algumas abaixo de AA para texto normal; estados frequentemente dependem de cor.
5. **Problemas:** contraste inconsistente, brilho/transparência reduzindo leitura e semântica dispersa.
6. **Severidade:** P1.
7. **Causas:** cores de marca usadas diretamente como cores de texto/estado e superfícies translúcidas.
8. **Três propostas:** A) saturar todas as cores; B) paleta sólida com pares semânticos testados; C) monocromia com cor apenas em CTA.
9. **Recomendação:** B, reservando cores vivas para áreas pequenas e usando texto/ícone/forma juntos.
10. **Impacto mobile:** estados reconhecíveis rapidamente, inclusive ao sol e em telas pequenas.
11. **Impacto desktop:** menor fadiga em painéis longos.
12. **Acessibilidade:** AA obrigatório; texto normal 7:1 como alvo; foco visível; teste de daltonismo; acerto/erro nunca só por cor.
13. **Performance:** somente tokens CSS, sem custo de runtime.
14. **Riscos:** perder personalidade ao escurecer tudo ou criar “arco-íris” sem hierarquia.
15. **Testes:** matriz light/dark, contraste por token, forced colors, daltonismo e screenshots.
16. **Arquivos que mudariam:** variáveis semânticas, botões, badges, alerts, feedback de estudo, loja/metas e testes.
