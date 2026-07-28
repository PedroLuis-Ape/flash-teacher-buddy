# 07 — Landing and Public Experience

1. **Escopo vistoriado:** landing, SEO, auth, páginas públicas, professores/listas/recursos públicos e prerender.
2. **Arquivos analisados:** roteamento, `GlobalLayout`, `SessionWatcher`, `sessionRouteAccess.ts`, landing, auth, sitemap/robots/llms e scripts de prerender.
3. **Rotas analisadas:** `/`, `/auth`, `/pt-br`, `/en` e famílias públicas inventariadas.
4. **Evidências:** `/pt-br` redireciona anonimamente para `/auth`; landing muito longa em 320 px; score SEO local 100/100; descoberta dinâmica ficou `BLOCKED_EXTERNAL`.
5. **Problemas:** P0 de classificação de rota; densidade/repetição mobile; risco de alterar HTML rastreável durante redesign.
6. **Severidade:** P0 para rota; P2 para comprimento/expressividade.
7. **Causas:** fontes divergentes de verdade para acesso; seções acumuladas; comportamento visual misturado ao conteúdo.
8. **Três propostas:** A) redesign sem tocar estrutura; B) primeiro manifesto tipado de rotas, depois compactação semântica; C) reconstrução completa da landing.
9. **Recomendação:** B; correção de rotas em PR isolado antes do visual público.
10. **Impacto mobile:** proposta e CTA acima da dobra, prova compacta, FAQ accordion acessível e menos repetição.
11. **Impacto desktop:** manter narrativa e autoridade com composição mais editorial.
12. **Acessibilidade:** headings, landmarks, foco, carrossel pausável, auth com labels e erros claros.
13. **Performance:** preservar prerender; vídeo poster-first; mídia lazy; sem JS para conteúdo essencial.
14. **Riscos:** regressão SEO, canonical incorreto, conteúdo oculto ou claims sem evidência.
15. **Testes:** guarda anônima/autenticada, HTML de `dist`, canonical, JSON-LD, sitemap, robots, llms, 320/390/1440 e Lighthouse.
16. **Arquivos que mudariam:** manifesto/guarda de rotas, testes, landing e estilos públicos; nenhuma fronteira público/privado sem PR dedicado.
