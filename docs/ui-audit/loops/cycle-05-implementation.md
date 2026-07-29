# Ciclo 05 — implementação do shell autenticado

## Decisão

Foi adotado um overlay CSS estático e reversível:

- `PrivateShell` recebeu somente o marcador `ape-private-shell`;
- Home recebeu `ape-private-home` e marcadores de composição;
- Biblioteca recebeu `ape-private-library` e marcadores de composição;
- o stylesheet novo é importado depois dos estilos legados;
- todas as regras começam em `html[data-visual-style="playful"] .ape-private-shell`;
- não há `!important`, hook novo, dependência ou árvore React alternativa.

## Contratos preservados

- `EconomyProvider` e `InstitutionProvider`: posição inalterada.
- Auth e hidratação: não alterados.
- `useHomeData`: não alterado.
- `libraryKeys`, queries, placeholder, mutations e reconciliação: não alterados.
- Supabase, RPCs, migrations e RLS: não alterados.
- Offline, StudyResume e indicadores globais: não alterados.
- Classic/Galaxy: continuam sob `.space-ui`.

## Laboratório local

Foi adicionado um fixture noindex e fora do grafo de produção para comparar a composição legada e o overlay Playful sem dados de contas. O fixture não faz chamadas de rede nem mutations.

## Rollback

Remover o marcador, o import e o stylesheet restaura a composição anterior. Nenhum dado precisa ser migrado ou revertido.
