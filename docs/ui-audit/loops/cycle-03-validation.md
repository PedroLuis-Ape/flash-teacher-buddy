# Ciclo 03 — validação da experiência pública

## Resultado da hipótese

| Cenário | Baseline | Depois | Redução |
| --- | ---: | ---: | ---: |
| Playful, landing, 320 px | 16.493 px | 14.007 px | 15,1% |
| Playful, landing, 1440 px | 7.261 px | 6.589 px | 9,3% |

A meta mobile foi atingida sem remoção de conteúdo.

## Gates determinísticos

- Typecheck: aprovado.
- Testes direcionados: 5 arquivos e 28 testes, aprovados em 3 execuções consecutivas.
- Vitest completo: 189 arquivos e 1.161 testes aprovados.
- Lint: 0 erros e os mesmos 69 avisos do baseline.
- Build e pré-render: aprovados.
- Rotas editoriais: 23.
- URLs públicas no contrato: 59.
- Score de visibilidade: 100/100.
- Canonical e JSON-LD: presentes na raiz, em `/pt-br/metodologia` e em `/en/methodology`.
- `robots.txt`, `llms.txt` e sitemaps: presentes.
- Orçamento do bundle: aprovado.

## Bundle

- JavaScript total gzip: 1.010,1 KiB.
- Maior chunk JavaScript gzip: 219,9 KiB.
- CSS total gzip: 48,0 KiB.
- Delta aproximado sobre a PR anterior: +0,2 KiB de JavaScript total, +0,3 KiB no maior chunk e +1,5 KiB de CSS.

## Regressão Classic

O screenshot Classic mobile permaneceu byte a byte idêntico.

- Baseline SHA-256: `C1C2D276BC1BF13331144402468F8891051558175FC353A4398FF90A9723242A`
- Depois SHA-256: `C1C2D276BC1BF13331144402468F8891051558175FC353A4398FF90A9723242A`
- [Classic depois](./assets/pr4-after-classic-landing-320.png)

## Isolamento

- `dist/tools/visual-qa/public-experience.html`: ausente.
- Caminhos `visual-qa`/`public-experience` no `dist`: 0.
- Supabase, migrations e dados: não acessados nem alterados.

## Evidências

- [Playful mobile](./assets/pr4-after-playful-landing-320.png)
- [Playful desktop](./assets/pr4-after-playful-landing-1440.png)
- [Playful claro](./assets/pr4-after-playful-light-landing-390.png)
- [Login Playful](./assets/pr4-after-playful-auth-390.png)
- [Cadastro Playful](./assets/pr4-after-playful-signup-390.png)
- [Galaxy preservado](./assets/pr4-after-galaxy-landing-390.png)
