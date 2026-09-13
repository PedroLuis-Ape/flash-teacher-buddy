---
cssclasses:
  - ape-ai-note
type: area
area: visual-polish
status: merged
priority: high
related:
  - "[[01-CURRENT-STATE]]"
  - "[[04-DECISIONS]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[12-PROCESS-LOG-2026-09-11]]"
---

# Área — Polimento visual

Escopo: layout, responsividade, microinterações, overlays, estados, jogos e experiência mobile do App Piteco.

Referências de execução:

- Especificação: `docs/superpowers/specs/2026-09-11-piteco-visual-polish-design.md`
- Plano: `docs/superpowers/plans/2026-09-11-piteco-visual-polish.md`
- Código: `C:\Users\pedro\AppData\Local\Temp\ape-mobile-visual-20260910`

Princípio: é o mesmo aplicativo, apenas mais refinado. Toda mudança deve preservar a capacidade original e ter rollback por commit.

O snapshot visual foi integrado à `main` em `1fb8186c`. A implementação permanece limitada à apresentação e responsividade; persistência, Supabase, autenticação, progresso e algoritmos continuam fora desta área.

## Identidade cromática — Fase 2 (2026-09-13)

- [DECISION] Direção A: base escura, neutros dessaturados e accents vivos. A
  paleta padrão `black` abandonou o roxo: `--primary` teal (172 70% 50%),
  `--secondary` índigo (232 60% 55%), `--accent` âmbar (38 92% 58%),
  `--background` neutro (222 20% 7%).
- [VERIFIED-REPO] Fonte única dos tokens: `src/styles/space-ui-v1.css`
  (`html[data-palette="..."]`). `src/index.css` mantém o `.dark` base e os
  gradientes/sombras; as paletas legadas `classic`/`fresh`/`ocean` continuam
  apenas como histórico e não são mais alcançáveis pela UI.
- [ROOT-CAUSE] Os tokens estavam **duplicados** em
  `src/styles/space-layouts.css` (`html[data-palette="black"] .space-ui{...}`).
  Como a landing e o shell rodam dentro de `.space-ui`, a cópia vencia por
  especificidade e travava a identidade antiga — trocar a paleta não mudava a
  tela. A duplicata foi removida e um contrato impede que volte.
- [VERIFIED-REPO] Roxo hardcoded removido de 7 componentes (16 ocorrências):
  tiles dos modos de jogo, raridade da loja, cards de revisão semântica do
  glossário, CTA de instalação e um contador de ranking (agora `text-primary`).
- [VERIFIED-TEST] `src/lib/__tests__/paletteContrast.contract.test.ts`: contraste
  WCAG AA em 8 pares + 3 cores sobre o fundo, hues principais fora do roxo,
  neutros dessaturados, zero classes `violet|purple|fuchsia` em `src/` e fonte
  única de tokens por paleta.
- [VERIFIED-RUNTIME] Em browser: `--primary` = `172 70% 50%` no root e no
  elemento; a tagline renderiza `rgb(38, 217, 193)`; sem overflow horizontal em
  320/360/375/390/430.

Related: [[01-CURRENT-STATE]] · [[04-DECISIONS]] · [[07-TESTS]] · [[08-RISKS]]
