# Hotfix final — layout mobile do modo Galáxia

## Causa raiz

O arquivo `space-ui-stars.css` sobrescrevia `position: fixed` da barra mobile com `position: relative`. Assim, a barra passava a participar do `flex` principal e empurrava todas as páginas para a direita.

## Correção

- preservação da posição fixa do `ApeTabBar` no mobile;
- app frame transformado em bloco no mobile;
- largura limitada ao viewport;
- remoção das camadas extras do Galáxia em telas pequenas;
- guard carregado também no `PublicShell` para proteger login e páginas públicas;
- substituição do hotfix anterior por regras mínimas de geometria.

## Teste obrigatório

Validar em celular: `/auth`, `/dashboard`, `/folders`, `/goals`, `/store` e `/profile`, alternando entre Galáxia e outro tema.
