# Auditoria e reestruturação de performance e navegação

Data: 2026-07-11
Projeto: App Piteco / flash-teacher-buddy

## Objetivo

Reduzir o tempo percebido de carregamento, evitar recarregamentos desnecessários ao navegar, tornar Biblioteca, Pastas, Listas e Estudo mais responsivos e remover gargalos de consulta e renderização sem alterar a identidade visual nem quebrar funcionalidades existentes.

## Princípios

1. Mudanças pequenas, reversíveis e verificáveis.
2. Preservar comportamento funcional antes de otimizar aparência.
3. Não esconder lentidão com animações; reduzir trabalho real.
4. Não aplicar migrations no banco de produção sem validação explícita.
5. Cada etapa deve produzir métricas, testes e um relatório claro.
6. O usuário só executará ações manuais quando publicação ou migration realmente forem necessárias.

## Problemas já confirmados

### Biblioteca e pastas

- `Folders.tsx` carrega pastas, listas e contagens manualmente e repete autenticação na mesma montagem.
- `InstitutionContext` executa uma segunda leitura de pastas e contagens para atualizar cartões já renderizados por manipulação direta do DOM.
- Ao voltar para Biblioteca, o estado tende a ser reconstruído e novas consultas são disparadas em vez de reaproveitar cache.
- Algumas mutações chamam `loadData()` completo, mesmo quando uma atualização otimista local seria suficiente.

### Página da pasta

- `Folder.tsx` carrega pasta e listas em processos separados.
- Ambos os processos consultam a sessão novamente.
- O estado `loading` é compartilhado por operações independentes, podendo ocultar conteúdo já disponível enquanto outra consulta ainda termina.
- O carregamento público, privado e de turma está misturado no mesmo componente, dificultando cache e previsibilidade.

### Página da lista

- A lista baixa todos os flashcards antes de limitar apenas a renderização.
- A paginação atual reduz DOM e re-renderização, mas não reduz transferência, parse e processamento inicial.
- O `select("*")` busca campos pesados que não são necessários para a visão resumida de todos os cards.
- Busca local exige que todos os cards já tenham sido transferidos e indexados no navegador.

### Navegação e shell

- A troca de rota remonta o conteúdo e pode descartar dados que ainda estão recentes.
- A transição visual é curta, mas não existe uma estratégia consistente de prefetch ao passar o mouse, tocar ou abrir um recurso.
- Contextos globais executam consultas que competem com a consulta da página atual.

### Banco

- O cliente publicado usa o projeto de dados `ymahldldyxvwjeruaxpr`.
- O conector Supabase disponível atualmente acessa `xrnfhhoxmmstagmelvyi`.
- Nenhuma conclusão sobre índices ou planos de execução do banco real será considerada definitiva até o projeto de produção estar acessível ou a SQL ser executada manualmente pelo usuário.

## Abordagens consideradas

### Abordagem A — otimizações pontuais

Corrigir consultas específicas sem alterar a arquitetura de dados das páginas.

Vantagens:
- menor risco imediato;
- poucas alterações por PR.

Desvantagens:
- mantém duplicação entre estado local, contextos e React Query;
- ganhos tendem a ser pequenos e regressões continuam prováveis.

### Abordagem B — cache central e carregamento progressivo

Migrar Biblioteca e Pasta para React Query, eliminar consultas duplicadas, usar dados anteriores durante transições, aplicar prefetch e introduzir paginação real para listas grandes.

Vantagens:
- melhora perceptível sem reescrever o app;
- reduz chamadas ao banco e telas vazias;
- permite migração gradual.

Desvantagens:
- exige definir chaves de cache e políticas de invalidação com cuidado.

### Abordagem C — reescrita completa da biblioteca

Criar um novo módulo de biblioteca, API e navegação paralelos.

Vantagens:
- arquitetura limpa desde o início.

Desvantagens:
- alto risco;
- duplicação temporária;
- grande chance de perder recursos existentes.

## Decisão

Adotar a Abordagem B. A otimização será incremental e seguirá as estruturas existentes, sem criar um segundo aplicativo ou motor paralelo.

## Arquitetura proposta

### 1. Camada de consultas da biblioteca

Criar um módulo único para consultas e chaves de cache:

- `libraryKeys.root(userId, institutionId)`
- `libraryKeys.folders(userId, institutionId)`
- `libraryKeys.folder(folderId)`
- `libraryKeys.folderLists(folderId)`
- `libraryKeys.list(listId)`
- `libraryKeys.listCards(listId, filters, cursor)`

Responsabilidades:
- obter sessão/usuário apenas por contexto de autenticação;
- executar consultas paralelas quando independentes;
- retornar modelos já normalizados;
- manter `staleTime` apropriado;
- preservar dados anteriores ao trocar instituição ou rota;
- invalidar apenas o escopo afetado por uma mutação.

### 2. Biblioteca

`Folders.tsx` deixará de possuir um carregador manual monolítico.

O novo fluxo:

1. identidade do usuário vem de `AuthContext`/`useAuthUser`;
2. instituição selecionada define a chave do cache;
3. pastas, listas favoritas e contagens são carregadas por uma consulta coordenada;
4. dados anteriores permanecem visíveis durante revalidação;
5. criar, mover ou excluir atualiza o cache imediatamente e revalida em segundo plano;
6. o contexto de instituição não consulta novamente as mesmas pastas nem altera o DOM manualmente.

Resultado esperado:
- voltar para Biblioteca mostra o conteúdo instantaneamente quando o cache ainda é válido;
- uma mutação não força recarga completa da página;
- menos chamadas duplicadas ao Supabase.

### 3. Página da pasta

Pasta, permissões e listas terão consultas separadas, mas coordenadas por cache.

Regras:
- conteúdo já carregado permanece na tela durante revalidação;
- o cabeçalho da pasta pode aparecer antes das listas;
- permissões são derivadas dos dados, não copiadas para vários estados manuais;
- caminhos privado, público e turma terão funções de consulta isoladas;
- o componente visual não chamará `getSession()` diretamente.

### 4. Página da lista

A otimização ocorrerá em duas fases.

#### Fase 4.1 — payload inicial leve

- substituir `select("*")` por seleção explícita dos campos necessários;
- carregar inicialmente apenas a primeira página;
- manter botão/scroll de carregamento adicional;
- preservar edição, exclusão, agrupamento e seleção.

#### Fase 4.2 — busca no servidor

Para listas acima de um limite definido, a busca deve consultar o servidor com debounce e paginação. Para listas pequenas, a busca local permanece para resposta instantânea.

Critério inicial:
- até 500 cards visíveis: busca local;
- acima de 500: busca paginada no servidor.

O limite ficará centralizado em configuração para ajuste posterior.

### 5. Prefetch e navegação

Adicionar prefetch controlado:

- ao apontar ou tocar uma pasta, pré-carregar metadados e primeira página de listas;
- ao apontar ou tocar uma lista, pré-carregar metadados e primeira página de cards;
- evitar prefetch em massa para todos os itens;
- usar atraso curto para não disparar consultas em movimentos acidentais.

A navegação deve:
- manter dados anteriores enquanto a rota nova resolve;
- exibir skeleton apenas para regiões ainda não disponíveis;
- evitar tela inteira vazia quando parte dos dados já está pronta.

### 6. Contextos globais

`InstitutionContext` continuará responsável por instituições e seleção, mas não por atualizar visualmente contagens de pastas.

Será removida a rotina que:
- busca novamente pastas e contagens;
- procura elementos por classe no DOM;
- altera textos manualmente.

As contagens serão derivadas diretamente dos dados da Biblioteca.

### 7. Estudo e jogos

Depois de Biblioteca/Pasta/Lista estabilizadas:

- medir montagem inicial de `Study.tsx` e cada modo;
- isolar timers, áudio e autoplay;
- evitar reconstrução desnecessária da fila;
- memoizar componentes de card com callbacks estáveis;
- pré-carregar mídia do próximo card quando aplicável;
- manter Foco Vermelho e demais escopos protegidos por testes existentes.

Nenhuma otimização de estudo poderá alterar regras de fila, repetição ou progresso sem teste dedicado.

## Fluxo de dados

1. Contexto de autenticação fornece usuário.
2. Contexto de instituição fornece apenas seleção e catálogo de instituições.
3. React Query resolve recursos da rota.
4. Componentes recebem dados normalizados.
5. Mutações atualizam o cache otimisticamente.
6. Revalidação confirma o estado no Supabase.
7. Navegação reaproveita cache recente e prefetch.

## Tratamento de erros

- Erro parcial não apaga dados já exibidos.
- Falha em contagem não impede abrir Biblioteca ou Pasta.
- Falha em prefetch nunca gera toast para o usuário.
- Falha na consulta principal oferece tentar novamente.
- Mutações otimistas fazem rollback do cache em caso de erro.
- Falta de RPC/migration deve produzir mensagem específica e instrução manual clara.

## Métricas e telemetria

Cada etapa deve medir no mínimo:

- número de chamadas Supabase na montagem;
- tempo até primeiro conteúdo útil;
- tempo até conteúdo completo;
- quantidade de linhas transferidas;
- número de componentes renderizados em listas grandes;
- tempo de retorno Biblioteca → Pasta → Biblioteca com cache quente.

As métricas de desenvolvimento não devem bloquear produção nem enviar dados pessoais.

## Testes

### Unitários

- construção de query keys;
- normalização de dados;
- políticas de atualização otimista;
- limites de paginação e busca;
- deduplicação de resultados.

### Integração

- Biblioteca mantém dados ao revalidar;
- mudar instituição usa cache separado;
- criar/mover/excluir atualiza somente os caches afetados;
- Pasta mostra cabeçalho enquanto listas carregam;
- Lista carrega próxima página sem duplicar cards.

### Regressão

- favoritos e marcas vermelhas continuam corretos;
- cards em camadas continuam agrupados;
- exclusão e desfazer continuam funcionando;
- importadores e glossários não são alterados por esta iniciativa;
- Foco Vermelho mantém uma ocorrência por card.

### Verificação obrigatória por PR

- `npm ci`;
- typecheck;
- testes;
- lint;
- build de produção;
- revisão do diff;
- teste manual do fluxo afetado no preview quando disponível.

## Plano de entrega

### PR 1 — fundação e Biblioteca

- módulo de query keys e consultas;
- migrar `Folders.tsx` para React Query;
- remover autenticação duplicada;
- remover atualização manual do DOM no contexto;
- cache e atualização otimista das principais mutações;
- testes da biblioteca.

### PR 2 — Pasta

- separar carregamento de pasta, permissões e listas;
- eliminar `getSession()` duplicado;
- manter conteúdo anterior na navegação;
- prefetch Biblioteca → Pasta;
- testes de pasta.

### PR 3 — Lista e paginação

- payload explícito e primeira página;
- paginação real;
- busca híbrida local/servidor;
- prefetch Pasta → Lista;
- testes de listas grandes.

### PR 4 — Estudo e fluidez

- métricas de montagem;
- reduzir re-renderizações;
- centralizar timers e áudio onde necessário;
- pré-carregar próximo card;
- testes de regressão dos modos.

### PR 5 — Banco

Somente após acesso ou evidência do Supabase de produção:
- `EXPLAIN ANALYZE` das consultas principais;
- índices estritamente necessários;
- RPCs consolidadas quando houver benefício mensurável;
- migrations versionadas e reversíveis.

## Critérios de conclusão

A iniciativa será considerada concluída quando:

1. voltar para Biblioteca com cache quente não exibir uma tela vazia;
2. Biblioteca não fizer consultas duplicadas de pastas e contagens;
3. abrir Pasta não repetir autenticação nem bloquear cabeçalho por listas;
4. Listas grandes não transferirem todos os cards antes do primeiro conteúdo;
5. navegação pré-carregar apenas o próximo destino provável;
6. CI permanecer verde em todas as PRs;
7. nenhuma regra de estudo, marcador ou card em camadas regredir;
8. toda ação manual necessária estiver documentada com SQL, local de execução e validação posterior.

## Feedback ao usuário

Após cada PR, o relatório seguirá este formato:

- **Status:** em auditoria, implementando, validando, pronta para merge ou mergeada.
- **Achados:** gargalos confirmados e evidências.
- **Mudanças:** arquivos e comportamento alterados.
- **Validação:** checks executados e respectivos resultados.
- **Ação manual:** nenhuma, publicar no Lovable, executar migration ou testar cenário específico.
- **Próxima etapa:** trabalho que começará em seguida.

## Ações manuais previstas

- Publicar no Lovable após cada conjunto aprovado de merges.
- Aplicar migration apenas se a PR de banco for aprovada e o projeto de produção não estiver conectado às ferramentas.
- Executar um roteiro curto de teste no preview para confirmar percepção de fluidez em dados reais.

Não será solicitado que o usuário edite código manualmente.