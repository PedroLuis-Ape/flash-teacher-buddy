# SEO internacional — procedimento de rollback

## Ponto de retorno

Antes do merge deste pacote, criar uma branch de segurança apontando para o commit atual da `main`.

Nome previsto:

`rollback/pre-international-seo-2026-07-02`

## Reversão rápida

Se a publicação causar regressão, a `main` deve ser restaurada ao commit salvo nessa branch de rollback ou o commit de merge deste pacote deve ser revertido.

## Escopo reversível

Este pacote altera somente:

- rotas públicas internacionais;
- metadados e dados estruturados;
- sitemap, `llms.txt` e redirects;
- pré-renderização e validações de build;
- documentação e arquivos de preview.

Não inclui migrations no Supabase nem mudanças na estrutura de dados.

## Verificações após rollback

1. `/` continua exibindo a landing original.
2. `/portal` continua acessível.
3. URLs legadas continuam respondendo.
4. build volta a usar somente o pré-render anterior.
5. `/pt-br` e `/en` deixam de existir até uma nova tentativa.
