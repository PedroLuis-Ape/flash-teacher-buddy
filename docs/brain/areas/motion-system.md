---
cssclasses:
  - ape-ai-note
type: area
domain: ui-motion
status: proposed
priority: medium
last_reviewed: 2026-09-11
related:
  - "[[areas/visual-polish]]"
  - "[[08-GAMES]]"
  - "[[03-ARCHITECTURE]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
---

# Motion System do App Piteco

## Origem e status

[DECISION] O usuário forneceu uma especificação para uma camada de motion,
hover e microinterações, principalmente desktop, preservando a identidade
visual e a estrutura atual. O design foi detalhado em
`docs/superpowers/specs/2026-09-11-piteco-motion-system-design.md`; a
implementação não começou e depende da revisão/aprovação antes do plano e do
código.

## Intenção de produto

O app deve parecer responsivo e vivo, sem parecer um brinquedo animado. Fora
dos jogos, as respostas são rápidas, discretas e previsíveis; dentro do Hub e
dos jogos, podem ser mais expressivas. Movimento deve comunicar interação,
seleção, progresso, sucesso, erro, estado e hierarquia, nunca ser o único
sinal da ação.

## Proposta registrada para aprovação

Recomendação: camada CSS-first com tokens compartilhados e um pequeno hook de
ponteiro somente onde houver benefício real, começando pelo Games Hub. Usar
`transform` e `opacity`, sem dependência pesada; manter foco visível, teclado,
toque, `prefers-reduced-motion` e alvos acessíveis. Expandir para Home,
cards/listas, navegação, overlays, feedback e progresso apenas após validar a
primeira fatia.

Alternativas consideradas:

1. Utilitários somente CSS — menor risco, mas limitado para tilt/glow contextual.
2. Biblioteca completa de animação — mais expressiva, porém adiciona peso e
   superfície de manutenção desnecessários neste momento.
3. CSS-first + ponte mínima de ponteiro — recomendada por equilibrar controle,
   performance, acessibilidade e a identidade existente.

## Guardrails

- Não alterar Supabase, Auth, RLS, sessões, autosave, pontuação, progresso,
  importadores, glossário, rotas públicas ou SEO.
- Sem hover-only: toda função precisa de equivalente por toque, foco ou estado
  selecionado.
- Tilt apenas em superfícies úteis, com prioridade para Games Hub; não aplicar
  em tabelas, formulários, listas densas ou diálogos.
- Magnetic apenas em CTAs principais quando permanecer previsível.
- Respeitar movimento reduzido removendo tilt/parallax e reduzindo shake e
  transições; feedback essencial continua disponível.
- Evitar animar layout (`width`, `height`, `top`, `left`) e efeitos caros em
  massa; limpar listeners, timers e observers.
- Não usar estado falso para progresso, XP, score ou streak.

## Ordem funcional proposta

1. Auditar componentes e tokens já existentes.
2. Definir tempos, elevação, escala, foco e feedback compartilhados.
3. Implementar a primeira fatia no Games Hub e validar em desktop/mobile.
4. Expandir com cuidado para Home, navegação, menus, overlays e feedback de
   estudo.
5. Revalidar redução de movimento, performance, overflow, layout shift,
   console e teclado.

Faixa inicial sugerida, sujeita a ajuste visual: fast 100–140 ms, normal
160–220 ms, emphasis 240–360 ms; lift 2–5 px; scale 1.01–1.025; tilt no
máximo 2–4 graus. Os valores não são contrato de implementação até a revisão
visual.

## Evidência e próximo gate

[UNKNOWN] Nenhum screenshot ou teste de interação do novo sistema foi
produzido nesta sessão. A validação futura deve seguir
OPEN → SCREENSHOT → INTERACT → IMPLEMENT → BUILD → REOPEN → COMPARE → TEST →
REFINE, cobrindo 1366×768, 1440×900, 1920×1080, 1280×720 e a matriz mobile.

Próximo gate: o usuário aprovar ou ajustar a abordagem recomendada; depois
escrever a especificação revisada e o plano antes de tocar no código.
