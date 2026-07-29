# Ciclo 03 — baseline da experiência pública

## Hipótese

Uma composição pública sólida e compacta do Piteco Play pode reduzir em pelo menos 15% a altura da landing em 320 px, sem remover conteúdo rastreável, alterar Auth ou tocar em dados.

## Base e limites

- Base: `441c6d9a` (`codex/playful-tokens-primitives`).
- Escopo: shell público, navegação, cabeçalhos editoriais, rodapé, CTA fixo, 23 páginas editoriais estáticas e apresentação visual de login/cadastro.
- Fora do escopo: conteúdo dinâmico do portal, perfis, pastas, listas, turmas, gameplay, shell autenticado, lógica de Auth, rotas, Supabase, migrations, RPCs e publicação.
- O modo Classic/Galaxy continua usando o caminho legado `.space-ui`.
- O modo Playful usa a fronteira isolada `.ape-public-shell`.

## Baseline mensurável

| Cenário | Altura total |
| --- | ---: |
| Classic, landing, 320 px | 16.302 px |
| Playful, landing, 320 px | 16.493 px |
| Playful, landing, 1440 px | 7.261 px |

Evidências:

- [Classic mobile](./assets/pr4-baseline-classic-landing-320.png)
- [Playful mobile](./assets/pr4-baseline-playful-landing-320.png)
- [Playful desktop](./assets/pr4-baseline-playful-landing-1440.png)
- [Playful Auth mobile](./assets/pr4-baseline-playful-auth-390.png)

## Guardrails

- Nenhum conteúdo editorial seria removido ou ocultado.
- Nenhum seletor público novo seria exposto nesta PR.
- Nenhuma leitura ou escrita de produção seria necessária.
- A correção da rota pública permanece separada na PR #356.
