# Revisão das funções de turmas

## Escopo

Revisão estática das sete funções responsáveis por criação, leitura e administração de turmas:

- `turmas-create`;
- `turmas-enroll`;
- `turmas-mine`;
- `turmas-as-aluno`;
- `turmas-update`;
- `turmas-delete`;
- `turmas-remove-member`.

Esta revisão não publica funções, não executa migrations, não acessa banco remoto e não cria recursos pagos.

## Contrato comum

Todas as sete funções são privadas e devem aceitar somente `POST` e `OPTIONS`, exigir autenticação, validar a sessão com `auth.getUser()`, responder com `Cache-Control: no-store`, operar com o JWT do usuário e declarar `verify_jwt = true`.

## Resultado por função

| Função | Resultado |
|---|---|
| `turmas-create` | Preservada a exigência de perfil de professor, limites de entrada e vínculo com o usuário autenticado. |
| `turmas-enroll` | Preservadas as validações de UUID, APE ID, turma ativa, propriedade e bloqueio de automatrícula. |
| `turmas-mine` | Adicionadas restrição de método, autenticação explícita e política de cache. |
| `turmas-as-aluno` | Removido o cliente administrativo; a leitura agora respeita as políticas RLS versionadas. |
| `turmas-update` | Adicionada validação de UUID e repetição dos filtros de propriedade e turma ativa na escrita. |
| `turmas-delete` | Preservado o soft delete com filtros repetidos na mutação. |
| `turmas-remove-member` | Adicionadas validações de método, sessão e UUID; a exclusão é filtrada por turma, usuário e matrícula ativa. |

## Decisões

### Leitura do aluno sem bypass de RLS

As políticas versionadas permitem ao aluno consultar sua própria matrícula e visualizar turmas das quais é membro. O cliente administrativo em `turmas-as-aluno` era desnecessário e foi removido.

### Filtros repetidos nas mutações

`turmas-update`, `turmas-delete` e `turmas-remove-member` repetem os filtros relevantes na escrita, em vez de depender apenas da conferência anterior.

### Remoção de membro compatível com os leitores atuais

`turmas-remove-member` mantém a exclusão da linha de matrícula. Isso evita que leitores existentes, que consultam ou contam `turma_membros`, voltem a exibir uma matrícula removida como linha inativa.

## Validação automatizada

Os testes estáticos verificam o registro das sete funções, autenticação explícita, restrição de método, cache, ausência de cliente administrativo, filtros das mutações e preservação do project ref oficial.

## Limitação

A revisão confirma apenas o código versionado. Ela não comprova o estado implantado, logs ou configuração remota e não executa qualquer alteração no Supabase.
