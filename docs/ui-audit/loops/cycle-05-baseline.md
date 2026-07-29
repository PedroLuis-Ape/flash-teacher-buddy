# Ciclo 05 — baseline do shell autenticado

## Hipótese

Uma camada visual aditiva pode tornar o shell autenticado, a Home e a Biblioteca coerentes com Piteco Play sem remontar providers, reiniciar sessão, alterar requisições ou modificar Classic/Galaxy.

## Base e escopo

- Base: `948b6cd2` (`codex/playful-public-experience`).
- Rotas desta onda: `/dashboard` e `/folders`.
- Fora do escopo: detalhes de pasta/lista, jogos, turmas, perfil, Auth, rotas, Supabase, React Query, persistência e publicação.
- Providers, side effects e a árvore privada permanecem exatamente na mesma posição.
- `.space-ui` permanece montado em todos os estilos visuais.

## Baseline local isolado

O ambiente local não possuía uma sessão autenticada. Para não solicitar credenciais, copiar sessão ou tocar em contas, a comparação visual foi feita em um fixture local/noindex com a mesma estrutura de classes.

| Superfície | Viewport | Altura | Overflow horizontal |
| --- | --- | ---: | --- |
| Home legado | 320 × 568 | 1.283 px | não |
| Biblioteca legada | 320 × 568 | 632 px | não |

Evidências:

- [Home legado](./assets/pr5-baseline-home-320.png)
- [Biblioteca legada](./assets/pr5-baseline-library-320.png)

## Must-haves

- nenhuma nova leitura ou escrita remota;
- nenhum hook de preferência dentro do shell;
- nenhum `key` ou árvore alternativa;
- estados loading, empty, error e retry preservados;
- controles mínimos de 44 px e foco visível;
- CSS estritamente limitado a `data-visual-style="playful"`.
