---
cssclasses:
  - ape-ai-note
---

# Testing and Quality

## Gates
**[VERIFICADO-REPO]**
- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `npm run build`
- `npm run preview:smoke`
- `npm run check`
- `npm run seo:visibility:score`.

`npm run check` também executa validações de i18n, ambiente, segurança, dependências e store packages.

## Ferramentas
- Vitest
- Playwright
- smoke scripts
- IndexedDB smoke
- SEO validators.

## Baseline 09/09
**[HISTÓRICO RECENTE / AUDITORIA]**
- typecheck passou;
- 240 arquivos / 1511 testes;
- lint 0 erros / 72 avisos;
- build passou;
- study outbox smoke em Chromium passou;
- preview 16/16.

Esses números não são prova do HEAD atual; são baseline.

## Preview Safety Gate
**[VERIFICADO-REPO]**
- main verde anterior = LKG;
- bootstrap/router/auth/dependency exige `preview:smoke`;
- `/__preview-health` independente de Supabase/sessão;
- falha de bootstrap deve renderizar tela recuperável.

## QA visual
UI/game exige:
- browser real;
- screenshot;
- click/tap;
- teclado;
- dialogs;
- console;
- mobile.

## Persistência
Testar:
refresh, aba fechada, offline, duas abas, revisão antiga, último card, resume, corrupção.

## Import
Matriz:
válido, vazio, inválido, parcial, grande, cancelar, rede, double submit, sucesso, round-trip.
