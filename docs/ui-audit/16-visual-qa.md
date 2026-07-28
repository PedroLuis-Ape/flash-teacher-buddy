# 16 — Visual QA and Regression

1. **Escopo vistoriado:** screenshots, estilos legados, light/dark, mobile/desktop, zoom, input, estados e idiomas.
2. **Arquivos analisados:** configuração de testes, scripts, rotas e componentes críticos.
3. **Rotas analisadas:** landing, auth, home, biblioteca, hub, todos os modos de estudo e classroom.
4. **Evidências:** não foi encontrada infraestrutura de Playwright/Cypress/Chromatic ou contrato de screenshots; Vitest cobre lógica, não composição visual.
5. **Problemas:** regressão visual depende de inspeção ad hoc; não há baseline por estilo/viewport/estado.
6. **Severidade:** P1.
7. **Causas:** crescimento funcional priorizado sem harness visual.
8. **Três propostas:** A) somente checklist manual; B) harness leve de screenshots + matriz manual; C) plataforma externa de visual diff.
9. **Recomendação:** B primeiro, sem nova dependência de produção; C pode ser avaliada depois.
10. **Impacto mobile:** matriz obrigatória 320/360/375/390/412/430, landscape, teclado e safe-area.
11. **Impacto desktop:** 1280/1440, zoom, mouse/teclado e densidade.
12. **Acessibilidade:** incluir foco, forced colors, reduced motion, leitor de tela manual e reflow.
13. **Performance:** capturas fora do bundle; não instrumentar produção para screenshots.
14. **Riscos:** snapshots frágeis, falsos positivos e cobertura superficial de estados.
15. **Testes:** classic/galaxy/playful × light/dark/system × rotas críticas × vazio/loading/erro/offline/texto longo/PT/EN.
16. **Arquivos que mudariam:** configuração/scripts de QA, fixtures seguras, documentação e baselines; nunca dados fictícios em produção.

## Matriz mínima de regressão

| Área | Estados críticos | Viewports |
|---|---|---|
| Landing/auth | normal, erro, loading, conteúdo longo | 320, 390, 1440 |
| Shell/home | vazio, dados, menu aberto, notificação | 320, 390, 1440 |
| Hub | preset, subpainel, teclado, scroll | 320, 390, 1440 |
| Estudo | cada modo, certo, errado, pulo, camadas, fim | 320, 390, 1440 |
| Classroom | sem acesso, lista, modal, nome longo | 320, 390, 1440 |
