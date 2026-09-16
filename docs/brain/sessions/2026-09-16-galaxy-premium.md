# Galaxy premium refinement — 2026-09-16

## Escopo
Refino incremental do modo Galaxy com prioridade visual para a landing pública. O conceito existente foi preservado; não houve migração para Three.js/WebGL.

## Diagnóstico
O background ativo era composto por SVGs, gradientes/CSS e Web Animations API, com tiers `full`, `balanced` e `static`. A aparência excessivamente suave vinha em parte dos próprios assets, especialmente blur 34 na nebulosa principal, 42 na poeira e 18/22 nas galáxias espirais.

## Implementação
- `GalaxyDepthCanvas.tsx`: campo procedural Canvas 2D com três planos de estrelas, DPR limitado, densidade adaptativa, FPS controlado e parallax muito sutil.
- `GalaxyVisualLayer.tsx`: integração do canvas sem remover a cena existente, além de composição especial para a landing.
- `space-galaxy-premium.css`: profundidade atmosférica, zona de legibilidade, composição mais rica no lado do produto e fallback estático premium.
- SVGs de nebulosa/poeira/galáxias: kernels de blur menores e detalhes finos adicionais.
- Mobile/reduced-motion: canvas animado removido; identidade mantida com composição CSS estática.

## Performance
O Canvas não usa DPR irrestrito, não adiciona listener de scroll e não tenta acompanhar 60 fps. A complexidade segue os tiers existentes do modo Galaxy e o loop para quando a página fica oculta.

## Parâmetros ajustáveis
Densidade de estrelas, limites de DPR, FPS alvo, parallax, drift, opacidade da nebulosa, composição do hero e gradientes de legibilidade estão centralizados no novo canvas/CSS premium.

Relatório detalhado: `reports/landing/2026-09-16-galaxy-premium.json`.
