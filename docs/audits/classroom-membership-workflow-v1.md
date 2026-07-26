# Auditoria de turmas, professores e alunos — workflow v1

## Hipótese da alteração

O fluxo canônico de pertencimento é `turmas` + `turma_membros`. O risco principal não é a ausência de uma tela, mas mutações distribuídas no navegador, busca global baseada em `subscriptions` e ausência de estados pendentes. A alteração mantém o schema atual e adiciona uma fronteira transacional para estados e autorização.

## Modelo preservado

- `turmas` continua sendo a entidade de turma em produção.
- `turma_membros.ativo` continua disponível como projeção de compatibilidade.
- `turma_membros.status` passa a ser o estado canônico: `requested`, `invited`, `active`, `rejected`, `cancelled`, `removed`, `left` ou `expired`.
- `classes`/`class_members` e `subscriptions` permanecem legados/compatibilidade; não são usados como fonte de membership no novo fluxo.
- Nenhuma conta, turma, membro, conteúdo ou dado de produção é apagado nesta branch.

## Fronteira de escrita

As escritas de membership são revogadas para `anon`/`authenticated` e passam pelos RPCs `SECURITY DEFINER` versionados:

- `transition_turma_membership_v1` para transições unitárias, idempotentes e bloqueadas por linha;
- `add_students_to_turma_v1` para inclusão em lote;
- `transition_turma_membership_public_v1` e `add_students_to_turma_by_public_id_v1` para resolver identificadores públicos dentro do servidor;
- `turma_membership_events` para auditoria de estado anterior/novo e ator.

## Preflight de acesso

`get_turma_access_v1` devolve somente o mínimo necessário para a rota: turma, professor, visibilidade e estado do usuário autenticado. Solicitações e convites de turmas privadas não são confundidos com uma turma inexistente. `list_my_turma_memberships_v1` permite que o aluno veja pendências sem consultar diretamente dados privados de outros usuários.

## Fluxos cobertos

1. aluno solicita entrada em turma pública;
2. professor aprova ou recusa;
3. professor convida por identificador público;
4. aluno aceita ou recusa convite;
5. aluno cancela solicitação ou sai de turma ativa;
6. professor adiciona/remove aluno com confirmação do servidor;
7. reenvio de uma mesma ação retorna estado idempotente, sem duplicar membro.

## Verificação e rollout

Esta branch não aplica migration remota, não altera `ymahldldyxvwjeruaxpr`, não publica pela Lovable e não troca chaves/configuração de Auth. Antes do rollout, aplicar a migration primeiro em ambiente controlado, gerar tipos a partir do banco real e executar os testes de dois usuários, RLS, concorrência, reload e rollback. Em caso de regressão, desativar as ações avançadas e manter somente o caminho básico já compatível; não fazer rollback destrutivo de schema.
