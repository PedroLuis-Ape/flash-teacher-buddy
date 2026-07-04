# Implantação: lista inteira para Cards Especiais

## Objetivo

Permitir que o proprietário de uma lista envie todos os seus itens estudáveis para a Caixa de Especiais em uma única ação, preservando a semântica atual por camada.

## Regras de domínio

- Card comum: entra uma vez.
- Card em camadas: cada camada real entra separadamente.
- Linha principal/agregadora de camadas: não entra.
- Card apagado (`deleted_at`): não entra.
- Repetir a operação: não cria duplicações.
- A marcação individual continua intacta.

## Entrada da interface

A primeira versão fica dentro da página Cards Especiais. O usuário abre o diálogo “Adicionar lista inteira”, escolhe uma lista própria e recebe uma prévia com:

- cards comuns;
- camadas;
- total estudável;
- itens já existentes;
- novos itens;
- agregadores técnicos ignorados.

Essa localização reduz risco na página `ListDetail`, que já concentra edição, busca, paginação, exclusão em massa e mesclagem de camadas.

## Persistência

O caminho principal usa a RPC transacional `add_list_flashcards_to_specials`.

Enquanto a migration ainda não estiver implantada no backend de produção, o frontend reconhece apenas o erro de RPC inexistente e usa um fallback controlado:

1. calcula os IDs elegíveis;
2. consulta duplicados em blocos;
3. grava em blocos de 200 com `ON CONFLICT DO NOTHING` via upsert;
4. registra os IDs realmente inseridos;
5. se um bloco falhar, remove os IDs inseridos pela própria operação;
6. invalida todos os caches da Caixa de Especiais.

Erros reais de permissão ou banco não acionam fallback silencioso.

## Escala

A leitura da Caixa de Especiais passa a:

- paginar todas as linhas da fila no PostgREST;
- buscar flashcards em blocos de 200 IDs;
- buscar títulos de listas em blocos;
- renderizar apenas 100 cards inicialmente, com “Carregar mais”.

A exportação existente continua usando lotes de 10, 20, 30 ou 50 cards.

## Rollback

`src/features/special-import/flags.ts` contém o interruptor `BULK_LIST_SPECIALS_ENABLED`.

Ao definir como `false`:

- o botão novo desaparece;
- marcação individual continua funcionando;
- a Caixa de Especiais continua funcionando;
- nenhuma linha existente é removida;
- a RPC pode permanecer instalada sem chamadas.

## Validação obrigatória

- unit tests da seleção de cards/camadas;
- typecheck;
- lint;
- build de produção;
- rebuild local do Supabase com a migration;
- teste de fila vazia;
- lista apenas com cards comuns;
- lista mista com camadas;
- execução repetida;
- lista com mais de 1.000 linhas;
- confirmação visual do preview antes do merge.
