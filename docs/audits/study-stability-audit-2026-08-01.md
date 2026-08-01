# Auditoria de estabilidade do estudo — 2026-08-01

## Escopo e baseline

Esta auditoria foi feita na branch `codex/study-loading-stability-audit-v2`, baseada em `origin/main` (`4d40ffba`, após os PRs #377 e #378). O escopo é a abertura e execução dos modos de estudo, principalmente o falso vazio de flashcards em entradas consecutivas, reload, conta, lista, modo, conexão lenta e cards em camadas.

Nenhuma migration, RPC, policy, grant, chave, sessão, dado de usuário ou projeto Supabase foi alterado remotamente. O runtime de dados permanece protegido pelo contrato do repositório: `ymahldldyxvwjeruaxpr`. O projeto administrativo `xrnfhhoxmmstagmelvyi` foi consultado somente em leitura; o acesso administrativo ao backend de produção não está disponível, portanto o estado de produção não é declarado a partir do ambiente gerenciado. O branch inclui apenas uma migration aditiva para permitir `mixed-adaptive` no contrato já existente de `study_sessions`; ela não foi aplicada remotamente.

## Constatações

### P0 — primeira resposta vazia podia encerrar o carregamento

`src/pages/Study.tsx` consultava os cards diretamente e, se a primeira consulta retornasse `[]`, mostrava toast e navegava para fora do estudo. A camada `dedupFetch` já fazia recuperação para algumas respostas HTTP vazias, mas não existia uma confirmação de vazio no nível do fluxo de estudo. Uma resposta vazia transitória causada por hidratação de Auth/RLS, cache ou conexão podia ser interpretada como uma lista sem cards.

`src/pages/MixedStudy.tsx` mantinha outro loader, com a mesma duplicação de consulta e sem o contrato comum de vazio confirmado.

### P0 — loading visual podia terminar antes da fila jogável

`Study.tsx` chamava `setLoading(false)` assim que os dados eram colocados em `flashcards`, enquanto preferências e `useStudyEngine` ainda preparavam `cardsOrder`. O readiness guard mitigava parte do intervalo, mas não tinha como diferenciar `[]` transitório de um deck legitimamente vazio.

### P1 — fronteira pública incompleta

O loader de `Study.tsx` reconhecia como público apenas `/portal/collection/`, embora a leitura RPC pública seja a de listas. Isso deixava caminhos de lista em portal dependerem de detecção de pathname parcial e podia conduzir a uma leitura privada vazia ou a uma navegação incorreta.

### P1 — Auth otimista sem estado de sessão não confirmado

Quando `getSession()` falhava, `AuthContext` mantinha a sessão persistida e a marcava imediatamente como `authenticated`. Isso preservava o shell, mas liberava o caminho de dados protegidos com uma credencial ainda não confirmada. A correção adiciona um estado `stale` que mantém a identidade disponível sem liberar o carregamento privado até a hidratação ser confirmada.

### P1 — camadas e modos não compartilhavam a mesma entrada

O colapso de camadas (`prepareLayeredStudyDeck`) era correto e o motor principal já tinha controles de geração. Entretanto, os dois pontos de entrada de jogo carregavam e preparavam os dados separadamente. Isso permitia que o modo principal e o modo misto recebessem conjuntos diferentes, especialmente durante troca rápida de rota, conta ou tentativa.

## Contrato adotado

O novo `studyDeckLoader`:

1. exige contexto de acesso já resolvido;
2. associa cada abertura a um `requestId` e recebe `AbortSignal`;
3. repete somente a leitura vazia, com atrasos limitados e abortáveis;
4. só retorna `empty` depois da confirmação, nunca durante loading;
5. prepara camadas no mesmo serviço para todos os modos;
6. trata um deck bruto não vazio que vira deck jogável vazio como erro de integridade, não como “lista sem cards”.

O frontend continua sem remover camadas/campos para forçar uma sessão. O vazio confirmado terá ação de tentar novamente e voltar; falha técnica terá recuperação separada.

## Fluxo de modos e persistência

Todos os modos acessíveis pelo motor principal passam a aceitar `mastery_rounds` ou `continuous`, inclusive flip. No modo gamificado, a navegação manual anterior/próxima fica bloqueada para não pular a contabilização da rodada. O término de rodada mostra a próxima rodada quando existir e, no fim do percurso, oferece jogar novamente ou sair.

O modo misto agora usa o mesmo loader, escopo de favoritos e estado vazio confirmado. Sua persistência remota foi alinhada às colunas reais de `study_sessions`; os campos inexistentes foram removidos do payload. A migration aditiva `20260801120000_allow_mixed_adaptive_study_sessions.sql` precisa ser revisada e aplicada controladamente no backend correto antes de depender da restauração remota do modo misto.

## Gates locais executados

- Typecheck: passou.
- Vitest: 198 arquivos e 1.195 testes passaram.
- Lint: passou sem erros; permanecem avisos preexistentes de hooks/UI.
- Build Vite: passou.
- Pré-render, sitemap, privacidade de autoria, bundle e SEO: passaram; `seo:visibility` marcou 100/100.

## Verificação de banco

No repositório existem as migrations de camadas atômicas (`20260712223000_atomic_layered_card_groups.sql`) e capabilities (`20260719000000_import_capabilities_v1.sql`). A listagem somente leitura do projeto gerenciado retornou ambas aplicadas e a consulta administrativa do RPC respondeu, mas com `auth` ausente — resultado esperado para uma chamada administrativa sem sessão de usuário. Isso não autoriza aplicar nada no backend `ymah` nem declarar o runtime de produção migrado.

## Riscos remanescentes antes da publicação

- É necessário executar os gates locais e um teste manual autenticado, portal, offline/reload e troca rápida de modo.
- A confirmação final do RPC/migrations no `ymah` continua dependente de acesso administrativo ou evidência fornecida pelo ambiente Lovable Cloud.
- O branch será entregue como PR; merge, publicação pela Lovable e qualquer ação remota ficam para a revisão/publicação do responsável.
