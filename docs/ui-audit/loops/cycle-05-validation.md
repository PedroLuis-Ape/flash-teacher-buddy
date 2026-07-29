# Ciclo 05 — validação do shell autenticado

## Gates determinísticos

- Typecheck: aprovado.
- Testes direcionados: 4 arquivos e 23 testes aprovados; núcleo crítico aprovado em 3 execuções consecutivas antes da rodada final.
- Vitest completo: 190 arquivos e 1.167 testes aprovados.
- Lint: 0 erros e os mesmos 69 avisos do baseline.
- Build e pré-render: aprovados.
- Privacidade da autoria: aprovada.
- Rotas editoriais: 23.
- URLs públicas: 59.
- Score de visibilidade: 100/100.
- Orçamento do bundle: aprovado.

## Bundle

- JavaScript total gzip: 1.010,5 KiB.
- Maior chunk JavaScript gzip: 219,9 KiB.
- CSS total gzip: 48,6 KiB.
- Delta aproximado sobre a onda anterior: +0,4 KiB de JavaScript total e +0,6 KiB de CSS.

## Isolamento

- `dist/tools/visual-qa/private-experience.html`: ausente.
- Texto `private-experience` em JS/HTML de `dist`: 0 ocorrências.
- Nenhum arquivo de Supabase faz parte do diff.
- O build gerou temporariamente dois arquivos conhecidos; ambos foram restaurados antes do commit.

## Resultado visual

| Superfície | Viewport | Altura | Overflow horizontal |
| --- | --- | ---: | --- |
| Home Playful | 320 × 568 | 1.304 px | não |
| Biblioteca Playful | 320 × 568 | 632 px | não |
| Home Playful | 390 × 844 | 1.304 px | não |
| Biblioteca Playful | 390 × 844 | 908 px | não |
| Home Playful | 1440 × 900 | 1.522 px | não |

Evidências:

- [Home 320](./assets/pr5-after-home-320.png)
- [Home 390](./assets/pr5-after-home-390.png)
- [Home desktop](./assets/pr5-after-home-1440.png)
- [Biblioteca 320](./assets/pr5-after-library-320.png)
- [Biblioteca 390](./assets/pr5-after-library-390.png)

## Limite da evidência

O redirect anônimo `/dashboard` → `/auth` foi confirmado. Reload e navegação com uma conta autenticada real não foram executados porque a sessão local estava ausente; essa verificação permanece para revisão humana do PR. Nenhuma credencial foi solicitada ou manipulada.
