---
cssclasses:
  - ape-ai-note
---

# Integração App Piteco ↔ extensão Salvar nas Notas (1.9.0) — 2026-09-13

## Estado e fonte da verdade

- [FATO CONFIRMADO] Worktree: `C:\Users\pedro\Documents\App-Piteco-Worktrees\ape-discovery-activation-20260913`; branch `integration/ape-program-20260913`.
- [FATO CONFIRMADO] Checkout da extensão: `C:\Users\pedro\Documents\Codex\2026-05-09\salvar-nas-notas` (1.8.0 → 1.9.0).
- [DECISAO VIGENTE] Nada foi commitado, mesclado, publicado ou enviado a produção; Supabase não foi tocado.

## Objetivo

O app detectar a extensão de verdade, mostrar um convite único e discreto cujo CTA apenas
abre a Chrome Web Store, e a extensão expor um canal externo mínimo para o domínio do APE.

## Implementação

- App: `src/features/browser-extension/` com `extensionConfig.ts`, `extensionRuntime.ts`,
  `extensionStatus.ts`, `extensionPromptStorage.ts`, `useBrowserExtensionStatus.ts`,
  `ExtensionInstallPrompt.tsx` (substitui `BrowserExtensionQuickInstall.tsx`) e
  `BrowserExtensionSettingsSection.tsx` (seção em Perfil/Configurações).
- App (integração): `PrivateShell.tsx` monta o convite no shell autenticado; `Profile.tsx`
  renderiza a seção de status; `public/extensao/store-config.json` passou a apontar para a loja.
- Extensão: `manifest.json` 1.9.0 + `externally_connectable`; `background.js` com
  `onMessageExternal` (só ping, remetente validado); `tools/package-chrome-web-store.mjs`
  valida o contrato externo e gera o ZIP na raiz.

## Arquivos alterados

- App (novos): `extensionConfig.ts`, `extensionRuntime.ts`, `extensionStatus.ts`,
  `extensionPromptStorage.ts`, `useBrowserExtensionStatus.ts`, `ExtensionInstallPrompt.tsx`,
  `BrowserExtensionSettingsSection.tsx`, `extensionIntegration.test.tsx`.
- App (alterados): `PrivateShell.tsx`, `Profile.tsx`, `browserExtension.contract.test.ts`,
  `public/extensao/store-config.json`.
- App (removido): `BrowserExtensionQuickInstall.tsx` (substituído, sem segundo convite).
- Extensão: `manifest.json`, `background.js`, `tools/package-chrome-web-store.mjs`,
  `dist-chrome-web-store/**` (regenerado) e `salvar-nas-notas-extension-1.9.0.zip`.

## Evidência RED/GREEN

- [VERIFIED-TEST] RED: a primeira execução focada falhou em 4 cenários. Dois por desenho
  (o card ficava montado invisível durante a espera, o que também o deixava focável por Tab)
  e um por **bug real**: o snooze não estava ligado à elegibilidade, então o convite ainda
  apareceria dentro dos 7 dias (cenário G).
- [VERIFIED-TEST] GREEN após corrigir o ciclo de fases (`entering` antes de `visible`) e ligar
  `isPromptSnoozed()` à elegibilidade: 19/19 testes focados em 2 arquivos (cenários A–J +
  3 testes unitários de `pingExtension`).

## Gates executados

- `node node_modules/typescript/bin/tsc --noEmit -p tsconfig.app.json` → 0.
- Suíte completa (`vitest run`): 283 arquivos / 1754 testes PASS.
- ESLint nos arquivos alterados: 0 erros (2 warnings pré-existentes, fora deste diff).
- `npm run build`: exit 0 com `APE SEO visibility score: 100/100`.
- `node tools/package-chrome-web-store.mjs` (extensão): exit 0, pacote 1.9.0 validado.

## Riscos residuais

- [PENDING] QA em navegador real (loja → instalação → convite some no foco) e a leitura do
  status na tela de Perfil não foram observados em runtime.
- [FOLLOW-UP] Cópia legada da extensão no repositório do app (1.0.0) segue divergente do
  checkout operacional; unificar é decisão separada.
- [RISCO] O snooze é lido no mount e revalidado no instante de aparecer; fechar em outra aba
  depois que o card ficou visível não o remove.

## Próximo passo

Rodar QA real com a extensão instalada a partir da loja, publicar o pacote 1.9.0 na Chrome
Web Store (decisão do Pedro) e então unificar/limpar a cópia legada.

Related: [[areas/browser-extension]] · [[07-TESTS]] · [[08-RISKS]] · [[01-CURRENT-STATE]]

