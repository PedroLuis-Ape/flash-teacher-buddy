---
cssclasses:
  - ape-ai-note
type: evidence
area: quality
status: verified
related:
  - "[[01-CURRENT-STATE]]"
  - "[[areas/visual-polish]]"
  - "[[08-RISKS]]"
  - "[[12-PROCESS-LOG-2026-09-11]]"
  - "[[README]]"
  - "[[learning/00-LEARNING-HUB]]"
  - "[[learning/attempts/2026-09-11-skill-integration]]"
---

# Testes e evidências

## Passados no bloco atual

- Contrato visual do shell: Vitest direcionado passou após `cc6ccc45`.
- TypeScript app: `tsc --noEmit -p tsconfig.app.json` passou.
- TypeScript node: `tsc --noEmit -p tsconfig.node.json` passou.
- Contrato de navegação visual do bloco Home/biblioteca/pastas passou.
- Contrato de overlays responsivos compartilhados: 2/2 testes passou.
- Contrato de detalhe de lista/exportação/configurações: 2/2 passou.
- Contrato do Hub de jogos: 6/6 passou.
- Contrato de overlays críticos de estudo/importação/exportação: 2/2 passou.
- Contrato de pasta e edição de card: 2/2 passou.
- Lint completo: exit 0, com 72 warnings e 0 errors.
- Chrome: Home, Biblioteca, Reforço, Hub de jogos e sessão in-game abriram; os seis modos foram navegados sem responder cards; medição não indicou overflow horizontal.
- Suite completa: 249 arquivos e 1.542 testes passaram.
- Build Vite de produção: passou; avisos existentes de CSS/chunks grandes não bloquearam o build.
- `preview:smoke` em porta isolada: passou em health, landing, auth, not-found, diagnóstico, component-error, Supabase indisponível e mobile 360/390/412.
- `seo:visibility:score`: 100/100 após a cadeia completa de prerenderização editorial; todos os gates passaram.
- Matriz CSS exata no Chrome, sem overflow horizontal, em 320x568, 360x800, 375x812, 390x844, 412x915, 430x932, 768x1024, 1280x720, 1366x768, 1440x900 e 1920x1080.
- Inspeção visual manual dos artefatos mobile 390x844 e desktop 1280x720 confirmou hierarquia preservada, controle in-game de `Ponto de atenção` visível e conteúdo sem corte horizontal.
- Segunda passada global em rotas privadas, jogos e públicas: após o carregamento, todas as rotas auditadas registraram `hasHOverflow: false`; o modo de escrita também foi conferido em landscape 844x390.
- Build local em `http://127.0.0.1:4318/landing`: landing reaberta na branch, CTA e demonstração preservados; FAQ aberto por interação real; console sem `error`/`warning` capturados nessa inspeção.
- Relatório completo: `docs/agent-orchestration/visual-release-report.md` no worktree da implementação.
- Verificação pós-merge: a `main` integrada aponta para `ddc6f89a`; 253 arquivos e 1.562 testes passaram, typecheck passou, lint ficou em 0 erros/72 avisos e o build Vite passou.
- Integração das Skills: os dois pacotes passaram `quick_validate.py`.
- TDD do `brain:check`: teste vermelho antes da implementação; depois Vitest
  focado passou em 2/2 casos, cobrindo vault válido e falhas de link/ID/
  placeholder.
- `node scripts/brain-check.mjs` no vault migrado: `BRAIN_CHECK_PASS`, 32 notas
  ativas e 162 wikilinks considerados, com `imports/` preservado como histórico.

## QA do preview Lovable autenticado — Reforço e Ponto de atenção — 2026-09-12

- [VERIFIED-CUA] No preview autenticado, `Everyday Collocations` abriu com 50
  cards e o modo `Virar Cartas` iniciou normalmente.
- [VERIFIED-CUA] O toggle in-game `Reforço` ativou, mudou para `No Reforço ✓`,
  elevou a Home de `0` para `1 card para revisar`, abriu o mesmo card em
  `/reinforcement` e permitiu removê-lo por essa área.
- [VERIFIED-CUA] A remoção pela área automática atualizou imediatamente o item,
  o contador e a Home para `0`; a lista original permaneceu com 50 cards.
- [VERIFIED-CUA] `Ponto de atenção` abriu o modal e ficou reversível no próprio
  card, mas sua marcação não aumentou o contador de Reforço nem criou item em
  `/reinforcement`.
- [IMPORTANT-FINDING] Se o contrato exige que Ponto de atenção também alimente
  a pasta automática Reforço, essa integração ainda está pendente de correção
  e reteste. O ciclo terminou limpo, sem dados temporários ativos.

## Contrato de ambiente

- `node scripts/check-platform.mjs`: passou neste worktree e confirmou
  `xrnfhhoxmmstagmelvyi` como projeto gerenciado e
  `ymahldldyxvwjeruaxpr` como runtime de dados de produção.
- A confirmação acima é `[VERIFIED-REPO]`, não `[VERIFIED-DB]`: nenhum schema,
  RPC, RLS ou dado remoto foi inspecionado nesta sessão.
- A validação da expansão do Motion System para outras superfícies ainda não
  começou; a primeira fatia do Games Hub está coberta na seção abaixo. Ver
  [[areas/motion-system]].

## Motion System — primeira fatia

- Vitest focado: 4 arquivos, 15 testes, passou.
- Suite completa: 256 arquivos, 1.569 testes, passou.
- TypeScript app e node: passou sem erros.
- ESLint: 0 erros e 72 avisos já existentes.
- Build Vite: passou; avisos existentes de CSS, browserslist e chunks grandes
  permanecem documentados.
- Preview local: seis cards no Games Hub; desktop 1280×720 respondeu com
  transform 3D e sem overflow; mobile/coarse 390×844 e reduced motion ficaram
  sem transform e sem overflow; foco + Enter preservaram a rota de estudo.

## Motion System — expansão aprovada e validada localmente

- O usuário aprovou a especificação completa após a validação da primeira
  fatia do Games Hub.
- A expansão foi implementada em Home, cards, navegação, overlays, feedback e
  progresso; os contratos cobrem a presença dos papéis compartilhados.

## Motion System — expansão compartilhada implementada

- TDD: o novo contrato começou vermelho em 4/4 por arquivos/classes ausentes;
  após a implementação e um ajuste de expectativa do contrato de `type`,
  passou em 4/4.
- O contrato do Games Hub passou em 6/6 após a inclusão de `data-motion-game`.
- Total focado da fatia: 10/10 testes.
- A expansão global passou os gates técnicos de typecheck, suite e lint/build;
  a confirmação visual no preview Lovable autenticado continua pendente.

- QA visual intermediário: os seis cards responderam ao hover em desktop,
  cada ícone recebeu a regra de modo após o ajuste de especificidade, mobile
  390x844 permaneceu sem overflow e reduced motion permaneceu neutro.

- Fechamento técnico local: 257 arquivos/1.575 testes, typecheck app/node,
  lint 0 erros/72 avisos preexistentes e build Vite passaram.
- Matriz de runtime exercitada no preview: 1280x720 desktop com tilt, 390x844
  coarse sem transformação e 1280x720 reduced motion neutro; todos sem
  overflow horizontal.
- Auditoria complementar: contrato dos cards residuais de loja/turmas/alunos
  passou em 5/5; typecheck e suite completa serão repetidos após o commit
  desta extensão.

## Limitações da evidência

O preview Lovable não estava disponível na sessão; a verificação visual foi feita na aba Chrome do app publicado e o build foi validado pelo preview smoke local. A validação de produção após merge/publicação ainda deve ser repetida no ambiente final.

## Pós-merge no main — 2026-09-11

- Vitest: `257/257` arquivos e `1576/1576` testes.
- TypeScript: app e node passaram sem erros.
- ESLint: `0` erros e `72` avisos preexistentes.
- Build: Vite passou; validadores editoriais, prerender, bundle e SEO também
  passaram. Permanecem apenas avisos conhecidos de CSS, browserslist e chunks.
- Memória: `node scripts/brain-check.mjs` passou (`35` notas, `224` wikilinks,
  `1` ID canônico).

Related: [[12-PROCESS-LOG-2026-09-11]] · [[areas/motion-system]] · [[08-RISKS]]
## Fechamento — ações icon-only no mobile — 2026-09-12

- TDD red/green no contrato focado: sem a correção, `2` falhas; com ela, `8/8`.
- Suíte completa: `258` arquivos e `1583` testes passando.
- `tsc --noEmit`: exit `0`.
- ESLint: `0` erros e `72` avisos preexistentes.
- `vite build`: concluído; permanecem apenas os avisos conhecidos de chunk.
- Mecanismo: `tailwind-merge` descarta `w-full` quando `w-auto` é declarado no
  mesmo `className`.
- Layout real: Chrome headless com container de `390 px` mediu botão `358 px` /
  texto `0 px` antes e botão `48 px` / texto `298 px` depois; em `>= 640 px` o
  resultado é idêntico antes e depois.
- Integração: commit `eea3261c` enviado a `origin/main`.
- QA visual no preview autenticado do Lovable (modo mobile, 393 px, commit
  `f522aea7`): ação de remover `48x44 px`, título do card `252 px`, CTA
  `Estudar agora` `312 px` e `scrollWidth` `378` — sem overflow horizontal.
  Em modo desktop as ações permaneceram `48x44 px`.

Related: [[12-PROCESS-LOG-2026-09-12]] · [[06-BUGS]] · [[08-RISKS]] · [[areas/visual-polish]]

## Catálogo público — Task 2 — 2026-09-13

- [VERIFIED-TEST] RED inicial: 7/7 falhas esperadas; RED de regressão do binding
  RPC: 1/7 falha esperada.
- [VERIFIED-TEST] GREEN focado: contrato do catálogo 7/7; conjunto catálogo,
  página canônica e sessão/rota 17/17.
- [VERIFIED-RUNTIME] Playwright: RPC real com payload vazio, retry recuperável,
  debounce sem history spam, filtros móveis expansíveis e zero overflow em
  320/1440 px. Ver [[sessions/2026-09-13-public-catalog-task-2]].
## Fechamento — legibilidade de títulos no mobile — 2026-09-12

- Contrato focado: `2/2`.
- Suíte completa: `259` arquivos e `1585` testes passando.
- `tsc --noEmit`: exit `0`; `vite build`: concluído.
- Medição no CSS compilado: o título ia de `78px` truncado para `139px`
  completos em container de `346px`; a linha cresce de `68px` para `115px`
  porque as ações descem para a segunda linha em telas estreitas.
- Integração: commit `3a836650` em `origin/main`.
- [PENDING] Preview autenticado desta segunda correção não conferido: o iframe
  parou de aceitar inspeção após o refresh.

Related: [[12-PROCESS-LOG-2026-09-12]] · [[06-BUGS]] · [[08-RISKS]] · [[areas/visual-polish]]
