# 15 — Performance

1. **Escopo vistoriado:** bundle, fontes, imagens, CSS, animações, rerenders, first paint, storage e lazy loading.
2. **Arquivos analisados:** build config/scripts, `index.html`, entrada React, CSS, assets e chunks principais.
3. **Rotas analisadas:** landing, shell, hub, estudo e turma.
4. **Evidências:** JS gzip total aproximado de 1.009 KiB; maior chunk 219 KiB gzip; CSS 44 KiB gzip; `App` e `TurmaDetail` geram avisos de chunk; Nunito já carrega oito pesos.
5. **Problemas:** orçamento apenas absoluto, falta segmentação RUM por estilo/rota e risco de ampliar JS com ornamentação.
6. **Severidade:** P1 para ausência de delta/medição; P2 para tamanho atual.
7. **Causas:** aplicação ampla, chunks grandes e falta de orçamento incremental do novo estilo.
8. **Três propostas:** A) adicionar biblioteca/asset pack; B) CSS-first + lazy decoration + orçamento de delta; C) redesign sem ilustração/motion.
9. **Recomendação:** B, com limite explícito por onda e rollback se regressar.
10. **Impacto mobile:** caminho crítico sem ilustração pesada; feedback de toque imediato.
11. **Impacto desktop:** assets maiores somente após idle/visibilidade.
12. **Acessibilidade:** desempenho é requisito de acesso; reduced motion também reduz custo.
13. **Performance:** alvo INP p75 ≤200 ms; sem CLS relevante; first paint correto; sem loop permanente.
14. **Riscos:** dupla árvore por estilo, fontes novas, SVGs complexos, backdrop blur e rerenders globais.
15. **Testes:** bundle delta, CSS delta, Lighthouse, INP local/RUM, troca de estilo, cold/warm load e throttling.
16. **Arquivos que mudariam:** boot, split points, assets/tokens, scripts de budget e telemetria sem dados pessoais.
