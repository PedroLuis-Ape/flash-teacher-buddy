# Super Importador Global V1

Implementação em andamento na branch `super-importador-global`.

## Entregue nesta etapa

- schema canônico `appteco-global-import`, versão 1;
- limites explícitos de arquivo, pastas, listas, cards e campos;
- parser tolerante a JSON cercado por texto/Markdown e vírgulas finais;
- validação estrutural e semântica com caminhos exatos;
- contagens declaradas versus reais;
- detecção de duplicatas de pasta, lista e card;
- gerador de prompt baseado no mesmo schema;
- prévia hierárquica antes de gravar;
- executor por compensação que rastreia IDs criados e desfaz em ordem inversa após falha;
- tabelas de histórico da importação;
- testes de Amor/Ódio/Felicidade, quantidades diferentes, múltiplas listas e pacotes inválidos.

## Compatibilidade

O importador simples atual permanece intacto. O novo fluxo será exposto em rota separada somente depois de passar por CI e revisão do fluxo de persistência.

## Segurança

A primeira implementação usa as políticas RLS existentes para criar pastas, listas e cards. Em caso de falha, o executor remove apenas os registros criados naquela tentativa. Uma RPC PostgreSQL transacional continua sendo a evolução preferida quando o ambiente de implantação permitir adicionar a função com segurança.
