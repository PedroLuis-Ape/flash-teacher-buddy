# Task 4 — Games Hub visual hierarchy

## Escopo

Polimento visual restrito ao Hub de jogos. `gameOptions`, `GAME_MODE_VISUALS`, hooks de preferências, `startGame`, rotas, escopo, precedência e handlers foram preservados. Nenhuma alteração foi feita em `index.css`, Task 3, Supabase ou lógica de lançamento.

## Implementação

- Cada modo recebeu uma descrição semântica no mapa visual compartilhado e essa descrição passou a integrar o nome acessível e o conteúdo visível do tile.
- Tiles passaram a expor `aria-pressed`, `data-recommended` e `data-configured`, além de badges textuais `RECOMENDADO`, `CONFIGURADO` e `BETA`; os estados não dependem apenas de cor.
- O grid usa uma coluna compacta no mobile, composição horizontal de menor altura e progressão para 2, 3 e 6 colunas em telas maiores.
- Foco de teclado recebeu indicador visível; `BETA` e `CONFIGURADO` foram agrupados para não se sobreporem.

## TDD e validação

- RED: `vitest run src/pages/__tests__/gamesHubVisual.contract.test.ts` — exit 1; 3 dos 4 contratos falharam pelos sinais visuais ausentes, enquanto o contrato de lançamento permaneceu válido.
- GREEN: `vitest run src/pages/__tests__/gamesHubVisual.contract.test.ts src/pages/__tests__/gamesHubLaunchIntent.contract.test.ts` — 2 arquivos, 10 testes aprovados.
- TypeScript app: `tsc --noEmit -p tsconfig.app.json` — exit 0.
- TypeScript node: `tsc --noEmit -p tsconfig.node.json` — exit 0.
- `git diff --check` — exit 0.
- ESLint direcionado aos arquivos de código e teste — executado antes do commit.

## Validação visual runtime

Não concluída nesta task: a inspeção não encontrou uma aba identificável do App Piteco ou preview Lovable disponível para abrir o Hub com segurança. Permanecem pendentes screenshots e interação real nos viewports do plano; isso é um gate de release, não uma alegação de validação visual concluída.

## Escopo do commit

O staging deve conter somente este relatório, `src/pages/GamesHub.tsx`, `src/features/study/lib/gameModeVisuals.ts` e `src/pages/__tests__/gamesHubVisual.contract.test.ts`. Alterações pré-existentes em Supabase, componentes de overlay, `.superpowers/`, `artifacts/`, documentação anterior e outros testes permanecem fora do commit.

## Rollback

Reverter o commit lógico desta task. O rollback é somente de UI/teste/documentação e não envolve reset de branch, limpeza de dados ou alteração remota.
