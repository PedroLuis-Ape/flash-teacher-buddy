# App Piteco — Reestruturação do Núcleo de Jogabilidade

Data: 2026-07-11
Status: design aprovado para planejamento; implementação ainda não iniciada
Escopo: estudo, jogabilidade, fluidez, persistência e estabilidade do núcleo

## 1. Objetivo

Reestruturar o núcleo de estudo do App Piteco para torná-lo previsível, fluido e testável, preservando os modos existentes e evitando uma reescrita total de alto risco.

O resultado esperado é um sistema em que cada modo tenha regras explícitas, a fila de cards seja produzida por uma única fonte de verdade, a persistência não determine a jogabilidade e mudanças futuras possam ser feitas sem quebrar filtros, favoritos, Lista Vermelha, direção, camadas ou retomada de sessão.

## 2. Problemas confirmados

### 2.1 Responsabilidades concentradas

`src/pages/Study.tsx` reúne carregamento, filtros, direção, favoritos, Lista Vermelha, camadas, navegação, edição e montagem dos modos.

`src/features/study/hooks/useStudyEngine.ts` reúne criação e restauração de sessão, fila, resultados, repetição, progresso, banco, economia, metas e atividade de turma.

Essa sobreposição permite que uma mudança visual ou de filtro altere a ordem, a sessão persistida ou o comportamento de outro modo.

### 2.2 Fontes de verdade concorrentes

A configuração efetiva de estudo pode depender de:

- parâmetros da URL;
- preferências locais;
- `gameSettings`;
- estado React;
- `cards_order` persistido;
- `localStorage`;
- favoritos e Lista Vermelha carregados de forma assíncrona.

Nenhuma camada possui hoje autoridade exclusiva sobre a configuração final da sessão.

### 2.3 Escopo de sessão inferido pela fila

Sessões de `all`, `favorites` e `redFocus` são diferenciadas comparando conjuntos de IDs dentro de `cards_order`. Isso é frágil quando cards são adicionados, removidos, agrupados, desagrupados ou quando uma identidade canônica muda.

### 2.4 Identidade de cards e grupos

Favoritos e Lista Vermelha usam identidade de grupo, enquanto o motor usa identidade jogável. Merge e unmerge podem alterar `parent_card_id`, deixando marcações antigas órfãs ou dependentes de heurísticas de compatibilidade.

### 2.5 Repetição e priorização misturadas

A lógica de repetição, reinjeção de erro, prioridade vermelha e ordem aleatória não é representada como uma política explícita. Isso permitiu que o Foco Vermelho herdasse repetição adicional e exigisse correções globais perigosas.

### 2.6 Ausência de barreira obrigatória de validação

O repositório possui `npm run check`, mas a branch principal não possui status check obrigatório associado ao commit mais recente. Correções podem entrar sem typecheck, testes, lint e build confirmados.

### 2.7 Separação intencional de Supabase

O código distingue:

- `xrnfhhoxmmstagmelvyi`: projeto gerenciado pelo Lovable;
- `ymahldldyxvwjeruaxpr`: backend de dados de produção utilizado pelo navegador.

A implementação não deve aplicar migrations de produção assumindo que `xrnf...` é o banco real. Toda mudança de schema precisa ser validada no projeto `ymah...` antes de ser considerada concluída.

## 3. Princípios obrigatórios

1. Uma única configuração efetiva por sessão.
2. Uma única função pura responsável por construir a fila.
3. IDs únicos na fila, exceto quando a política de repetição autorizar explicitamente cópias.
4. Filtros não podem depender de outro filtro por conveniência interna.
5. Persistência salva estado; não decide regras do jogo.
6. Componentes visuais não modificam diretamente a fila.
7. Cada etapa deve ser pequena, reversível e coberta por testes.
8. Nenhuma migration será aplicada cegamente no projeto gerenciado do Lovable.

## 4. Arquitetura proposta

### 4.1 Configuração canônica

Criar um contrato único:

```ts
type StudyScope = "all" | "favorites" | "red";
type StudyOrder = "sequential" | "random";
type RepetitionPolicy = "none" | "missed-only" | "adaptive";

type StudySessionConfig = {
  mode: StudyMode;
  scope: StudyScope;
  order: StudyOrder;
  direction: StudyDirection;
  repetition: RepetitionPolicy;
  fastMode: boolean;
};
```

O Foco Vermelho será representado diretamente:

```ts
{
  scope: "red",
  order: "sequential",
  repetition: "none"
}
```

Ele não dependerá de `subset: favorites`.

### 4.2 Planejador puro de fila

Criar `buildStudyQueue(input)` sem React, Supabase ou efeitos colaterais.

Entrada:

- cards jogáveis;
- configuração canônica;
- favoritos;
- Lista Vermelha;
- progresso opcional;
- semente opcional para ordem aleatória testável.

Saída:

- fila final de IDs;
- cards ignorados e motivo;
- metadados de diagnóstico.

Responsabilidades:

- resolver identidade canônica para identidade jogável;
- aplicar escopo;
- deduplicar;
- preservar ordem original no sequencial;
- embaralhar apenas no aleatório;
- aplicar repetição somente quando a política permitir.

### 4.3 Controlador de sessão

Criar uma camada de estado independente da UI com eventos explícitos:

- `START`;
- `ANSWER`;
- `SKIP`;
- `NEXT`;
- `PREVIOUS`;
- `RESTART`;
- `COMPLETE`;
- `CHANGE_CONFIG`.

O controlador retorna o próximo estado sem acessar banco ou navegador.

### 4.4 Adaptador de persistência

Separar operações Supabase em um serviço dedicado:

- carregar ou criar sessão;
- salvar índice;
- salvar respostas em lote;
- concluir sessão;
- restaurar sessão pelo identificador explícito de escopo.

A evolução ideal do schema inclui campos como:

```text
scope
order_mode
repetition_policy
direction
queue_version
```

Até a migration ser validada em produção, o frontend deve manter compatibilidade com sessões antigas.

### 4.5 Camada de apresentação

`Study.tsx` passa a atuar como orquestrador fino:

1. resolve contexto e dados;
2. produz `StudySessionConfig`;
3. chama o planejador/controlador;
4. escolhe a visualização do modo;
5. encaminha eventos do usuário.

Cada modo recebe o mesmo contrato de navegação e resultado.

## 5. Regras por escopo

### Todos

- inclui todos os cards jogáveis;
- respeita ordem configurada;
- repetição conforme política do modo.

### Favoritos

- inclui somente favoritos resolvidos para a entrada jogável;
- não mistura Lista Vermelha automaticamente;
- repetição conforme política explícita.

### Foco Vermelho

- inclui somente Lista Vermelha;
- deduplica por entrada jogável;
- preserva a ordem da lista original;
- não embaralha;
- não reinjeta erro;
- não aplica peso;
- não cria novas rodadas;
- termina no último card.

## 6. Regras por modo

### Flip puro

- marcação `Sabia/Não sabia` não avança automaticamente;
- navegação manual explícita;
- seleção de texto não vira o card;
- autoplay é uma camada independente e para em interação manual.

### Misto

- cada submodo segue o fluxo do modo misto;
- reinjeção por erro só pode ocorrer com `repetition = adaptive`;
- o Flip dentro do misto não herda o comportamento manual do Flip puro quando o fluxo exigir avanço.

### Escrita, múltipla escolha e desembaralhar

- todos usam o mesmo evento `ANSWER`;
- correção e pontuação permanecem centralizadas;
- nenhum modo altera `cardsOrder` diretamente.

## 7. Persistência e banco

### 7.1 Compatibilidade

Durante a migração:

- sessões antigas continuam legíveis;
- novas sessões recebem versão de fila;
- mudança de configuração cria ou seleciona a sessão do escopo correto;
- nunca concluir automaticamente sessões de outros escopos.

### 7.2 Escritas

- respostas acumuladas em buffer;
- flush por quantidade, tempo, saída e conclusão;
- idempotência para impedir dupla contagem;
- conclusão espera respostas pendentes antes de calcular recompensa.

### 7.3 Supabase

Antes de alterar produção:

1. confirmar acesso ao projeto `ymahldldyxvwjeruaxpr`;
2. comparar schema e migrations com `xrnfhhoxmmstagmelvyi`;
3. testar migration em ambiente isolado;
4. validar RLS, índices e planos de consulta;
5. somente então aplicar no projeto de dados.

## 8. Fluidez e desempenho

Após estabilizar as regras:

- reduzir dependências e reexecuções de efeitos em `Study.tsx`;
- evitar reconstrução da fila em cada render;
- pré-carregar dados do próximo card;
- centralizar timers e cancelamento de áudio;
- impedir consultas antes da autenticação estar resolvida;
- impedir que respostas vazias de RLS contaminem cache durante reload do Lovable;
- medir tempo de entrada no jogo, troca de card e conclusão;
- revisar layout e interação separadamente em desktop e mobile.

Metas iniciais:

- primeira interação disponível sem espera artificial adicional;
- troca de card sem consulta de banco bloqueante;
- nenhuma mudança de escopo zerando outro progresso;
- nenhuma duplicação não autorizada na fila;
- nenhuma fala ou timer sobrevivendo à troca de tela.

## 9. Testes obrigatórios

### Unitários

- fila sequencial preserva ordem;
- aleatório mantém conjunto e não duplica;
- Foco Vermelho retorna cada card uma vez;
- favoritos e vermelho são independentes;
- repetição `none` nunca injeta card;
- identidades de cards normais e layered;
- merge/unmerge preserva ou migra status.

### Contrato

- todos os modos emitem os mesmos eventos básicos;
- conclusão faz flush antes da recompensa;
- trocar escopo preserva sessões separadas;
- restaurar sessão usa configuração e versão corretas.

### Integração

- sessão completa no Flip;
- sessão completa no misto;
- Foco Vermelho com 50 cards gera 50 posições únicas;
- retomada após refresh;
- desktop, teclado e seleção de texto;
- mobile, toque e swipe.

### E2E mínimo

- abrir lista, iniciar modo, responder e concluir;
- trocar entre todos, favoritos e vermelho;
- sair e retomar;
- alternar direção;
- confirmar recompensa única.

## 10. Sequência de implementação

### PR 1 — Proteção e testes do comportamento atual

- testes de fila e Foco Vermelho;
- workflow obrigatório de typecheck, testes, lint e build;
- corrigir a alteração global que zerou prioridade vermelha fora do Foco Vermelho.

### PR 2 — Configuração canônica

- introduzir `StudySessionConfig`;
- adaptar UI existente sem mudar comportamento;
- eliminar dependência conceitual entre vermelho e favoritos.

### PR 3 — Planejador de fila

- implementar `buildStudyQueue`;
- migrar filtros, deduplicação, ordem e repetição;
- comparar nova e antiga fila em modo diagnóstico antes do corte.

### PR 4 — Foco Vermelho completo

- utilizar `scope: red`;
- fila linear única;
- remover caminhos antigos de injeção vermelha.

### PR 5 — Controlador de sessão

- centralizar eventos e transições;
- retirar mutações de fila dos componentes.

### PR 6 — Persistência versionada

- serviço de sessões;
- compatibilidade com sessões antigas;
- migration somente após auditoria do projeto de produção.

### PR 7 — Migração dos modos

- Flip;
- escrita;
- múltipla escolha;
- desembaralhar;
- misto.

### PR 8 — Fluidez e instrumentação

- re-renderizações;
- carregamento;
- timers;
- áudio;
- métricas de tempo;
- desktop e mobile.

### PR 9 — Limpeza final

- remover código legado;
- consolidar hooks;
- atualizar documentação;
- fechar flags temporárias.

## 11. Estratégia de entrega

- nenhuma PR grande e irreversível;
- cada PR contém escopo, testes e rollback claro;
- migrations em PR própria;
- feature flags para cortes arriscados;
- não fazer commits diretos na `main` durante a reestruturação;
- merge somente após validação automática e teste manual do fluxo afetado.

## 12. Critérios de conclusão

A reestruturação será considerada concluída quando:

1. toda fila for criada pelo planejador único;
2. todos os modos usarem o controlador comum;
3. Foco Vermelho executar uma fila linear sem repetição;
4. favoritos, vermelho e todos forem escopos independentes;
5. sessões persistirem configuração explícita;
6. `Study.tsx` não contiver regras internas de fila;
7. CI bloquear regressões de typecheck, testes, lint e build;
8. testes E2E cobrirem os fluxos críticos;
9. banco de produção tiver migrations e RLS verificadas;
10. métricas de fluidez demonstrarem troca de card e retomada sem travamentos perceptíveis.

## 13. Fora do escopo inicial

- redesenho visual completo do aplicativo;
- novos modos de jogo;
- mudança da economia ou valores de recompensa;
- reescrita dos importadores;
- troca de provedor de backend;
- remoção da separação intencional entre projeto gerenciado e banco de dados de produção.
