# Ciclo 03 — implementação da experiência pública

## Decisão

Foi adotada uma fronteira visual explícita no `PublicShell`:

- Playful recebe `.ape-public-shell` e os estilos de `piteco-play-public.css`;
- Classic e Galaxy preservam exatamente o caminho legado `.space-ui`;
- todos os estilos novos são escopados por `html[data-visual-style="playful"]`;
- não foram adicionados `!important`, dependências, assets remotos ou lógica de dados.

## Superfícies tratadas

- navegação e rodapé públicos;
- cabeçalho e barra de retorno editorial;
- landing e CTA fixo;
- 23 páginas editoriais por meio de `EditorialPage`;
- apresentação do login e cadastro, sem alteração no fluxo de autenticação;
- foco, alvos táteis, movimento reduzido e responsividade.

## QA local

Foi criado um ativador estritamente local para comparar Classic, Galaxy e Playful. Ele:

- só grava a preferência visual no `localhost`;
- não entra no grafo de produção;
- não faz chamadas de banco;
- não altera rotas, sessão ou conteúdo.

## Segurança

- Supabase: não acessado.
- Auth: lógica não alterada.
- Migrations/RPC/RLS: não alterados.
- Dados públicos ou privados: não gravados.
- Deploy/publicação: não executados.
