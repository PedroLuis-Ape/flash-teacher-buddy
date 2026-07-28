# Ciclo 01 — validação

## Gates determinísticos

- Typecheck: aprovado.
- Vitest completo: 188 arquivos e 1.156 testes aprovados.
- Testes críticos: 3 execuções consecutivas aprovadas.
- Lint: 0 erros e os mesmos 69 avisos do baseline.
- Build público: aprovado.
- Pré-render: 23 rotas editoriais aprovadas.
- Contrato SEO: 59 URLs aprovadas.
- Score de visibilidade: 100/100.
- Privacidade da autoria pública: aprovada.
- Orçamento do bundle: aprovado.

## Bundle depois da alteração

- Módulos transformados: 3.883.
- JavaScript total gzip: 1.009,9 KiB.
- Maior chunk JavaScript gzip: 219,6 KiB.
- CSS total gzip: 46,5 KiB.
- Delta sobre o baseline: +0,2 KiB de JavaScript total, +0,2 KiB no maior chunk e +2,2 KiB de CSS.

## Isolamento

- `dist/tools/visual-qa/primitives.html`: ausente.
- Texto identificador do laboratório no `dist`: 0 ocorrências.
- Supabase, migrations e dados: não acessados nem alterados.

## Regressão Clássica

O screenshot mobile Clássico depois da alteração é byte a byte idêntico ao baseline.

- Baseline SHA-256: `488F4C8622A73113E4356A6445E397AFF04B577741C5121C79135A7AB4A5A368`
- Depois SHA-256: `488F4C8622A73113E4356A6445E397AFF04B577741C5121C79135A7AB4A5A368`
- [Clássico depois](./assets/pr3-classic-auth-mobile-390-after.png)

## Resultado

A hipótese do ciclo foi confirmada. O alicerce Playful pode seguir para adoção gradual por telas, preservando o rollback para Classic.
