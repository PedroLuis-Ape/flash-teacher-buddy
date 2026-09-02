# 01 — Design Research

1. **Escopo vistoriado:** interfaces educacionais expressivas, Material 3 Expressive, Apple HIG, WCAG 2.2, feedback, progresso, gamificação e mobile.
2. **Arquivos analisados:** especificação anexada, `index.html`, estilos globais, componentes públicos, shell e estudo.
3. **Rotas analisadas:** `/`, `/auth`, `/pt-br`, portal e superfícies de estudo inventariadas.
4. **Evidências:** pesquisa oficial do Google associa expressividade funcional a cor, forma, tamanho, contenção e movimento; Apple e WCAG reforçam legibilidade, foco, reflow, movimento opcional e alvos adequados.
5. **Problemas:** linguagem atual depende demais de superfícies translúcidas; hierarquia pouco tátil; landing mobile longa; não há contrato de estilo independente.
6. **Severidade:** P1 para legibilidade/arquitetura; P2 para densidade pública.
7. **Causas:** evolução por paletas e patches globais, sem camada semântica única.
8. **Três propostas:** A) Piteco Soft, conservador e sólido; B) Piteco Play, tátil e expressivo; C) Piteco Adventure, com mapas/missões e maior ornamentação.
9. **Recomendação:** Piteco Play, usando expressividade para indicar função e estado, não como decoração constante.
10. **Impacto mobile:** maior clareza de ação e compactação progressiva; evitar empilhamento e animação contínua.
11. **Impacto desktop:** permite densidade maior sem perder hierarquia.
12. **Acessibilidade:** AA como gate; AAA para texto normal e alvos quando mensurável; informação nunca só por cor ou movimento.
13. **Performance:** CSS, SVG existente e decoração lazy; sem nova biblioteca de animação.
14. **Riscos:** copiar concorrentes, infantilizar administração ou transformar cada interação em celebração.
15. **Testes:** contraste, teclado, reduced motion, 320–430 px, zoom/reflow, screenshots e INP.
16. **Arquivos que mudariam:** tokens, boot visual, seletores, primitives, estilos públicos/privados e testes; nenhum arquivo Supabase.

## Referências primárias

- Google Design, Material 3 Expressive research.
- Material Design 3.
- Apple Human Interface Guidelines: accessibility, layout e motion.
- W3C WCAG 2.2 e orientações de target size.
- web.dev: INP e otimização de responsividade.
