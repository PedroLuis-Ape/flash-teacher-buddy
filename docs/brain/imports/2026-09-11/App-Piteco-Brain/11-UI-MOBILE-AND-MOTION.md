---
cssclasses:
  - ape-ai-note
---

# UI, Mobile and Motion

## Objetivo
**[DECISÃO]**
Refinar sem redesenhar:
- hierarquia;
- spacing;
- tipografia;
- consistência;
- feedback;
- responsividade;
- sensação de qualidade.

## Viewports móveis
- 320×568
- 360×800
- 375×812
- 390×844
- 412×915
- 430×932
- 768×1024.

Desktop:
1280×720, 1366×768, 1440×900, 1920×1080.

## Loop visual
abrir → screenshot → identificar → corrigir → rebuild → reabrir → screenshot → comparar → interagir → repetir.

Build verde não encerra QA visual.

## Procurar
- overflow horizontal;
- width fixa;
- 100vw problemático;
- absolute fora da tela;
- dialog maior que viewport;
- input coberto pelo teclado;
- footer/CTA coberto;
- safe areas;
- grids espremidos;
- touch targets;
- hover sem tap/focus;
- z-index/overlay.

## Motion
Jogos devem ser o ponto mais vivo:
- press/tap;
- card enter/exit;
- success/error;
- streak/score;
- progress;
- completion;
- loading.

Evitar blur/glass/partículas permanentes, flashes, animação lenta e layout shift.

Priorizar `transform` e `opacity`.
Respeitar `prefers-reduced-motion`.

## Teclado virtual
Especialmente Write/Rewrite:
- input visível;
- Corrigir acessível;
- feedback não escondido;
- scroll previsível;
- header compacto.

## Dependências
Usar Tailwind/shadcn/Radix existentes antes de adicionar biblioteca de motion.
