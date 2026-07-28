# Ciclo 01 — baseline de tokens e primitivos

## Hipótese

Tokens semânticos e primitivos compartilhados de botão, card, badge, texto e superfície podem sustentar o Piteco Play sem alterar a renderização do modo Clássico nem tocar em persistência remota.

## Limites

- Base: `06cf15c6` (`codex/visual-preference-foundation`).
- Branch: `codex/playful-tokens-primitives`.
- Nenhuma alteração em Supabase, Auth, RLS, migration, RPC ou dados.
- Nenhuma exposição do laboratório de QA no build de produção.
- Nenhuma alteração deliberada em páginas ou fluxos de produto.

## Medições antes da alteração

- Módulos transformados: 3.882.
- JavaScript total gzip: 1.009,7 KiB.
- Maior chunk JavaScript gzip: 219,4 KiB.
- CSS total gzip: 44,3 KiB.
- Lint: 0 erros e 69 avisos preexistentes.

## Evidências visuais

- Desktop Clássico: [baseline 1440](./assets/pr3-baseline-auth-desktop-1440.png)
- Mobile Clássico: [baseline 390](./assets/pr3-baseline-auth-mobile-390-viewport.png)

## Riscos monitorados

1. Vazamento de regras Playful para Classic ou Galaxy.
2. Contraste insuficiente em estados desabilitados e feedback.
3. Primitivo visual inventando semântica interativa.
4. Laboratório local incluído no artefato público.
5. Crescimento desproporcional do bundle.
