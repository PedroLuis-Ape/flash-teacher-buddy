# App Piteco — Motion System e Hovers Avançados

## Status

Rascunho para revisão do usuário. Esta especificação descreve uma camada
visual aditiva; não autoriza ainda alterações de código, backend ou publicação.

## Objetivo

Fazer o App Piteco responder visualmente a interação, seleção, progresso,
sucesso, erro e hierarquia sem transformá-lo em uma interface excessivamente
animada. Fora dos jogos, o movimento deve ser rápido, discreto e previsível.
No Hub de jogos e dentro dos jogos, pode ser um pouco mais expressivo, sempre
sem atrasar a resposta funcional.

## Restrições não negociáveis

- Preservar identidade visual, rotas, estrutura principal e design system atual.
- Não alterar Supabase, Auth, RLS, sessões, autosave, pontuação, progresso,
  importadores, glossário, SEO ou lógica de navegação.
- Não criar hover-only: toda informação ou ação importante também deve funcionar
  por teclado, foco, toque, pressão ou estado selecionado.
- Manter foco visível, semântica, ARIA, contraste e alvos de toque adequados.
- `prefers-reduced-motion` deve remover tilt/parallax e reduzir deslocamentos,
  shakes e transições, preservando feedback essencial não animado.
- Preferir `transform`, `opacity` e variáveis CSS; evitar animar layout e não
  adicionar biblioteca pesada sem benefício demonstrável.

## Abordagem escolhida

CSS-first + ponte mínima de ponteiro, sem dependência nova inicialmente.

CSS ficará responsável por tokens, transições, hover, foco, press, estados e
feedback simples. Um hook ou utilitário pequeno poderá atualizar variáveis CSS
de ponteiro em superfícies selecionadas, apenas quando `pointer: fine` e sem
movimento reduzido. Isso permite tilt/glow no Games Hub sem espalhar estado
React por cada movimento do cursor.

Alternativas rejeitadas nesta fase:

1. Somente CSS: seguro e simples, mas insuficiente para tilt/glow contextual.
2. Biblioteca completa de animação: oferece mais recursos do que o objetivo
   exige e acrescenta peso, manutenção e risco de regressão.

## Camada de tokens

Criar tokens compartilhados em CSS/Tailwind, ajustáveis depois da primeira
inspeção visual:

```css
--ape-motion-fast: 120ms;
--ape-motion-normal: 190ms;
--ape-motion-emphasis: 300ms;
--ape-motion-ease-out: cubic-bezier(.2,.8,.2,1);
--ape-motion-lift: 3px;
--ape-motion-hover-scale: 1.015;
--ape-motion-press-scale: .985;
--ape-motion-tilt-limit: 3deg;
```

As faixas permitidas são fast 100–140 ms, normal 160–220 ms, emphasis
240–360 ms, lift 2–5 px, escala 1.01–1.025 e tilt máximo de 2–4 graus. O
valor final deve ser decidido por comparação de screenshots, não por número
isolado.

## Primitivas e contratos

Usar classes/utilitários existentes sempre que forem suficientes. Se a
auditoria mostrar repetição real, criar primitivas pequenas e sem lógica de
produto:

- `InteractiveCard`: hover, foco, press e estado selecionado; não altera
  navegação nem payload.
- `MotionButton`: lift/press/foco para CTAs; magnetic somente em CTAs
  principais e apenas se permanecer previsível.
- `GameCardMotion`: superfície do Games Hub com glow/tilt opcional e assinatura
  visual do jogo.
- `AnimatedProgress`: interpola somente entre valores reais já recebidos; não
  cria progresso falso.
- `MotionMenuItem`: indicador ativo e transição curta para menus.
- `SuccessFeedback` e `ErrorFeedback`: feedback local e breve, sem reordenar
  layout ou substituir mensagens semânticas.

Cada primitiva deve aceitar `className`, preservar `ref`/semântica do elemento
base e não capturar clique ou teclado além do comportamento original.

## Superfícies prioritárias

### Primeira fatia: Games Hub

Todas as cartas compartilham lift sutil, sombra/borda reativa, foco e micro-
interação do ícone. Cada jogo recebe apenas uma assinatura pequena:

- Rewrite: onda/áudio discreta.
- Flip: rotação curta do ícone.
- Multiple Choice: expansão mínima da opção.
- Unscramble: deslocamento sutil de bloco.
- Race: acento de streak.
- Mixed: combinação contida de duas respostas anteriores.

Essas assinaturas não podem virar mini-jogos nem substituir texto ou estado.

### Expansão condicionada à validação

Depois de a primeira fatia passar: Home/dashboard, cards de pastas/listas,
navegação, menus/dropdowns/popovers/tooltips, feedback dos jogos, progresso,
XP/score/streak e conclusão. Tabelas, formulários, listas densas e diálogos
ficam sem tilt; recebem apenas foco, hover discreto e press.

## Interações

- Cards: lift de 2–5 px, escala quase imperceptível, borda/sombra e ícone.
- Glow: radial e discreto em cards escuros importantes; desligado em touch.
- Tilt: somente Games Hub ou superfície equivalente, máximo 2–4 graus.
- Botões: hover/foco, pointer-down com pequena redução e retorno imediato.
- Navegação: indicador ativo com transição de cor/fundo/ícone/texto, sem mudar
  routing.
- Menus: opacity + escala/deslocamento curto, sem atraso perceptível.
- Linhas: hover leve e ações secundárias acessíveis por teclado e toque.
- Estudo: fade curto com pequeno deslocamento, sem espera entre respostas.
- Sucesso: pulso/borda/check/score local breve; sem flash verde ou partículas
  por resposta.
- Erro: shake pequeno/highlight local; sem layout shift.
- Estados vazios: flutuação quase imperceptível, nunca distração.

## Implementação do ponteiro

O ponteiro deve ser opt-in por componente, limitar listeners à superfície
visível e atualizar variáveis CSS. Não renderizar a cada movimento se uma
variável CSS ou `requestAnimationFrame` resolver. Remover listeners e cancelar
frames no unmount. Não executar tracking em dispositivos coarse/touch nem com
`prefers-reduced-motion: reduce`.

## Reduced motion e acessibilidade

O fallback reduzido deve manter estados, foco e feedback via cor, ícone,
texto, borda ou `aria-live` quando apropriado. A ausência de animação não pode
remover contexto. Foco de teclado precisa ser visualmente equivalente ao hover
e mais evidente quando necessário.

## Performance e segurança de escopo

Não animar `width`, `height`, `top`, `left` ou propriedades que provoquem
reflow em massa. Evitar filtros, blur, backdrop e box-shadow grandes em muitos
elementos. Não introduzir timers sem limpeza. Nenhum handler deve chamar
mutação de dados, invalidar query ou alterar identidade de card.

## Fluxo de validação

Seguir o ciclo:

`OPEN → SCREENSHOT → INTERACT → IDENTIFY → IMPLEMENT → BUILD → REOPEN → SCREENSHOT → COMPARE → TEST → REFINE`

Viewports desktop: 1280×720, 1366×768, 1440×900, 1920×1080. Viewports
mobile/tablet: 320×568, 360×800, 375×812, 390×844, 412×915, 430×932 e
768×1024.

Testar mouse, click, pointer-down/up, Tab/foco, teclado, toque/press,
scroll, abertura/fechamento de menu/dialog, navegação, resposta e conclusão.

Gates técnicos depois da implementação: `npm run typecheck`, `npm run test`,
`npm run lint`, `npm run build` e `npm run brain:check`. Em browser, verificar
console, overflow horizontal, layout shift, foco, touch, reduced motion e
ausência de atraso funcional.

## Critérios de aceitação

- Games Hub demonstra uma linguagem comum e assinaturas discretas por jogo.
- Hover, foco e toque são coerentes; nenhuma ação depende só de hover.
- Mobile não recebe tracking de cursor nem overflow/scroll desnecessário.
- Reduced motion remove movimento não essencial sem perder informação.
- Progresso, XP, score e streak usam apenas valores reais.
- Não há regressão funcional, console error, layout shift relevante ou aumento
  injustificado do bundle.
- O Segundo Cérebro recebe screenshots/evidências, decisões, riscos e lições
  antes do handoff.

## Fora do escopo

Não corrigir nesta entrega bugs de dados, runtime Supabase, Auth, sessões,
importação, pontuação ou persistência. Se aparecerem durante QA, registrar em
[[areas/supabase-runtime]] ou na área funcional adequada e abrir tarefa
separada.

## Próximo gate

O usuário deve revisar esta especificação. Após aprovação, será criado um
plano de implementação separado e, em seguida, a alteração será executada em
worktree isolado com TDD e validação visual real.
