# Loop técnico de visibilidade — 2026-07-25

## Baseline

- Commit: `67916d55`.
- Build: aprovado.
- Score: 100/100.
- Rotas editoriais no HTML inicial: 23.
- Gargalo editorial: páginas localizadas curtas, sobretudo em inglês.
- Regressão objetiva: fallback fictício no diretório público.

## Hipótese

Remover o professor sintético do portal e manter a falha da RPC visível melhora integridade factual e citabilidade sem alterar banco, publicação, conteúdo privado ou arquitetura visual.

## Iteração 1

- **Score anterior:** 100/100.
- **Mudança:** remoção do `PREVIEW_TEACHER`, classificação explícita de RPC ausente, estado de erro recuperável e uma única autoridade de SEO na rota.
- **Expansão textual:** nenhuma.
- **Risco introduzido:** o portal pode exibir indisponibilidade em ambientes sem a RPC, que é o estado verdadeiro e diagnosticável.
- **Testes direcionados:** 4 testes aprovados; typecheck e lint direcionado aprovados.
- **Validação completa:** typecheck aprovado; 179 arquivos e 1.085 testes aprovados; lint sem erros; build e pré-render aprovados.
- **Artefato renderizado:** `/portal` com 1 canonical (`https://www.apeeducation.org/portal`), 1 H1 e 4 blocos JSON-LD.
- **Score atual:** 100/100.
- **Próximo passo:** revisão humana do PR; não ampliar conteúdo antes do próximo ciclo externo, a partir de 2026-08-05.
