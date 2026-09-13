---
cssclasses:
  - ape-ai-note
type: session
date: 2026-09-13
agent: clara-worker
area: browser-extension
related:
  - "[[areas/browser-extension]]"
  - "[[01-CURRENT-STATE]]"
  - "[[06-BUGS]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[sessions/2026-09-13-extensao-salvar-nas-notas]]"
  - "[[learning/lessons/2026-09-13-gate-auth-em-superficie-publica]]"
---

# Convite da extensão na landing pública — 2026-09-13

## Objetivo

O convite para instalar a extensão "Salvar nas Notas" não aparecia na landing
pública, nem para visitante sem login. A regra pedida: a landing DEVE ser
elegível sem autenticação; o app autenticado continua elegível; nenhuma
superfície mostra com extensão instalada, mobile, navegador incompatível,
snooze ativo ou convite já visto na sessão.

## Causa raiz

Duas barreiras somadas, as duas no mesmo desenho:

1. **Montagem só no shell autenticado.** `GlobalLayout` só renderiza
   `PrivateShell` quando `status === "authenticated" && isProtectedPath(pathname)`,
   e `/` está em `PUBLIC_EXACT` (não é rota protegida). A landing cai sempre no
   `PublicShell`, que não montava o convite. O componente existia e nunca era
   instanciado naquela superfície.
2. **Gate de autenticação dentro do componente.** `ExtensionInstallPrompt`
   exigia a prop `authenticated` (default `false`) e só então habilitava
   `useBrowserExtensionStatus({ enabled: authenticated })`. Sem login o ping
   nem era disparado e `status` permanecia `"unknown"` — mesmo que o componente
   fosse montado na landing, nada apareceria.

## Gates antes e depois (landing, desktop Chromium, extensão ausente, storage limpo)

| Gate | Antes | Depois |
| --- | --- | --- |
| extensionDetected | false (ping nem rodava) | false |
| browserCompatible | true | true |
| isDesktop | true | true |
| authenticated | **false (bloqueava)** | false — auditado, não é gate |
| snoozeActive | false | false |
| seenThisSession | false | false |
| finalEligibility | **false** | **true** |
| reasonNotShown | `auth-gate` + superfície não montada | `null` |

## Correção

- `src/features/browser-extension/extensionPromptPolicy.ts` (novo): superfície
  (`public-landing` | `authenticated-app` | `null`) e avaliação dos 7 gates com
  `reasonNotShown`, além do diagnóstico de desenvolvimento
  `window.pitecoExtensionPromptDebug` (sem PII, inerte em produção).
- `src/features/browser-extension/BrowserExtensionPromptMount.tsx` (novo):
  **único** ponto de montagem, chamado uma vez por `GlobalLayout`. Resolve a
  superfície com rota + sessão + Safe Mode.
- `ExtensionInstallPrompt.tsx`: o gate de autenticação deixou de existir;
  `route`/`authenticatedSession` viraram diagnóstico. Comportamento preservado:
  5 s de espera, 15 s visível, auto-dismiss por sessão, snooze de 7 dias no X,
  X acessível, CTA para a Chrome Web Store em nova aba (`noopener noreferrer`),
  ping com timeout e falha silenciosa.
- `useBrowserExtensionStatus.ts`: opção `enabled` removida — não existe mais
  superfície "autenticada" como pré-condição do ping.
- `PrivateShell.tsx`: montagem antiga removida (com comentário apontando o novo
  lar); `GlobalLayout.tsx`: montagem única. Rotas de estudo em tela cheia e Safe
  Mode continuam suprimindo o convite.

## Evidência RED/GREEN

- [VERIFIED-TEST] RED: 11 falhas em 24 testes da suíte focada ao transformar os
  cenários em "landing sem login" — nenhuma instância aparecia e o ping não era
  disparado, exatamente o comportamento reportado.
- [VERIFIED-TEST] GREEN: 45/45 em `src/features/browser-extension`
  (`extensionIntegration.test.tsx`, `extensionPromptPolicy.test.ts`,
  `browserExtension.contract.test.ts`), incluindo M1–M5 (uma instância na
  landing, uma no app autenticado, zero em `/auth`, zero em `/list/.../study`,
  zero em Safe Mode).
- [VERIFIED-BUILD] `npm run build` exit 0, SEO 100/100, orçamento de bundle
  aprovado. `npm run typecheck` exit 0.

## Limites e pendências

- [PENDING] QA em navegador real (Chrome com a extensão instalada) não foi
  executado nesta rodada; a garantia é de contrato + unidade.
- [KNOWN-LIMIT] A suíte completa apresentou timeouts não determinísticos em
  testes pesados de varredura (`paletteContrast.contract.test.ts` em uma
  execução, `folderGlossarySemanticReview.test.ts` na outra) sob a carga de 288
  arquivos; os mesmos testes passam isolados e em execução focada. Não é
  regressão deste diff.
- [DECISAO SUBSTITUIDA] O registro anterior que dizia "convite só para usuário
  autenticado" deixa de valer; ver [[sessions/2026-09-13-extensao-salvar-nas-notas]].

Classificação: `FINAL` para o contrato local; `PENDING` para QA de navegador real.

