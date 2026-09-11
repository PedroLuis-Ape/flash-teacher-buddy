---
cssclasses:
  - ape-ai-note
---

# Area — Mobile

## Viewports obrigatórios
- 320×568
- 360×800
- 375×812
- 390×844
- 412×915
- 430×932
- 768×1024

## Superfícies prioritárias
- Games Hub
- Study
- Flip
- Write
- Rewrite
- Multiple Choice
- Unscramble
- Mixed/Mastery
- Importadores
- Dialogs/Sheets
- Turmas
- Navegação global

## Procurar agressivamente
- overflow horizontal;
- widths fixas;
- `100vw` que inclui scrollbar/safe area;
- controles fora da viewport;
- teclado cobrindo input/CTA;
- header grande demais;
- bottom bar cobrindo conteúdo;
- sheet/dialog sem scroll interno;
- touch target pequeno;
- hover sem equivalente touch;
- problemas de landscape;
- problemas de safe area.

## Critério de saída
Nenhuma tela é considerada pronta só porque “abre”.
Precisa:
- caber;
- ser legível;
- ser clicável;
- funcionar com teclado;
- sobreviver a rotação/resize razoável;
- manter ações principais acessíveis.
