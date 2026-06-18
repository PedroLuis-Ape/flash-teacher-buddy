# Super Importador Global V1

## Status

Implementação concluída e mesclada na `main`.

## Entregue

- rota própria em `/import/super`;
- botão separado do importador simples;
- schema canônico `appteco-global-import`, versão 1;
- parser tolerante a respostas de IA e vírgulas finais;
- validação estrutural e semântica com caminhos exatos;
- prévia hierárquica de pastas, listas e cards;
- nomes de pastas e listas totalmente livres;
- criação ou reutilização de pastas e listas;
- políticas de duplicata: ignorar, copiar ou cancelar;
- gerador de prompt configurável;
- histórico por lote;
- RPC PostgreSQL atômica;
- idempotência por `request_id`;
- desfazer seguro, preservando conteúdo criado depois da importação.

## Compatibilidade

O importador simples permanece intacto. O fluxo de autenticação e as contas existentes não foram alterados por esta implementação.

## Segurança

A gravação final acontece em uma única chamada RPC no PostgreSQL. Qualquer erro durante a importação faz a transação falhar por completo, evitando dados parciais. O desfazer remove somente entidades criadas pelo lote e preserva conteúdo posterior.

## Validação

TypeScript, testes, lint e build de produção passaram no CI antes do merge.
