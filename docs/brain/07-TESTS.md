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

## Limitações da evidência

O preview Lovable não estava disponível na sessão; a verificação visual foi feita na aba Chrome do app publicado e o build foi validado pelo preview smoke local. A validação de produção após merge/publicação ainda deve ser repetida no ambiente final.
