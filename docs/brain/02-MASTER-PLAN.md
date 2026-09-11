---
cssclasses:
  - ape-ai-note
---

# Master Plan — Polimento Visual Piteco

## Objetivo

Fazer o aplicativo existente parecer mais refinado, vivo, consistente e responsivo, mantendo identidade, rotas e lógica. Mobile é prioridade absoluta.

## Sequência

1. Shell responsivo, safe-area, foco e microinterações.
2. Home, biblioteca, reforço e pastas.
3. Detalhe de lista, Special Cards e overlays.
4. Games Hub e hierarquia dos modos.
5. Feedback visual dos jogos e conclusão.
6. Dialogs, sheets, popovers, temas, estados vazios/loading/erro e acessibilidade.
7. Segunda passada global, matriz mobile, evidências e release report.

## Viewports obrigatórios

Portrait: `320x568`, `360x800`, `375x812`, `390x844`, `412x915`, `430x932`, `768x1024`.

Desktop: `1280x720`, `1366x768`, `1440x900`, `1920x1080`.

## Gates

- Inspecionar, screenshot, corrigir, build, reabrir, comparar e interagir.
- Verificar overflow, clipping, touch, teclado, safe-area, reduced-motion e console.
- Não alterar Supabase, RLS, auth, progresso, algoritmos, importação/exportação ou SEO.
- Não declarar concluído enquanto a validação visual real e os comandos finais não tiverem evidência fresca.

## Artefatos esperados

Relatório em `reports/visual-polish/2026-09-11-piteco-visual-polish.md` e screenshots conceituais antes/depois em `artifacts/visual-polish/` quando forem mantidos como evidência.
