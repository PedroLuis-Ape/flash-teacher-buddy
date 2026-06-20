# Revisão das Edge Functions de atribuições

## Escopo

Revisão estática e somente leitura das funções:

- `atribuicoes-create`;
- `atribuicoes-delete`;
- `atribuicoes-update-status`;
- `atribuicoes-minhas`;
- `atribuicoes-by-turma`;
- `atribuicoes-progresso-alunos`.

Nenhuma função foi publicada e nenhum banco foi acessado ou alterado durante esta revisão.

## Classificação

| Função | Autenticação | Tipo de acesso | Decisão de política |
|---|---|---|---|
| `atribuicoes-create` | usuário autenticado | cria atribuição, cópias de conteúdo e status usando o cliente do usuário | privada, JWT obrigatório |
| `atribuicoes-delete` | usuário autenticado e dono da turma | exclusão destrutiva usando o cliente do usuário | privada, JWT obrigatório |
| `atribuicoes-update-status` | usuário autenticado | usa cliente administrativo após validar usuário e vínculo com a turma | privada, JWT obrigatório e elevada |
| `atribuicoes-minhas` | usuário autenticado | leitura filtrada pelo próprio `user.id` | privada, JWT obrigatório |
| `atribuicoes-by-turma` | usuário autenticado, membro ou dono | usa cliente administrativo para leitura agregada | privada, JWT obrigatório e elevada |
| `atribuicoes-progresso-alunos` | usuário autenticado e dono da turma | leitura de progresso pelo cliente do usuário | privada, JWT obrigatório |

## Controles encontrados

- todas as funções consultadas validam uma sessão autenticada;
- criação, exclusão e progresso verificam a propriedade da turma;
- atualização de status força `aluno_id` a partir do token e não aceita esse identificador do corpo da requisição;
- atualização de status verifica a associação do aluno à turma antes de escrever;
- consulta por turma valida se o usuário é dono ou membro ativo;
- a consulta “minhas atribuições” filtra pelo usuário autenticado.

## Pontos que permanecem sob observação

- `atribuicoes-update-status` e `atribuicoes-by-turma` ignoram RLS por utilizarem acesso administrativo; por isso ficam registradas como elevadas;
- `atribuicoes-delete` remove conteúdo copiado em várias tabelas e deve continuar dependendo de checagem de propriedade e políticas RLS corretas;
- a concessão de pontos em `atribuicoes-update-status` deve ser revisada futuramente quanto a concorrência e repetição de transições;
- a revisão estática não comprova as políticas implantadas no projeto Supabase de produção.

## Resultado

As seis funções podem entrar gradualmente em `supabase/config.toml` com `verify_jwt = true`. Somente `atribuicoes-update-status` e `atribuicoes-by-turma` devem ser classificadas como elevadas nesta etapa.
