# Persistência geral de preferências de estudo

Data: 2026-07-12

## Contexto

O App Piteco já possui persistência parcial em `useStudyPreferences`, baseada em `localStorage` por usuário. Ela guarda `mode`, `direction`, `order`, `favoritesOnly` e `fastMode`. O Hub de Jogos também envia parte dessas escolhas pela URL.

O problema atual é que preferência permanente, configuração temporária da URL e estado local da sessão são misturados. Um link pode acabar alterando o valor que será salvo; algumas opções são lembradas apenas no mesmo navegador; e não existe uma substituição explícita por lista.

## Objetivo

Criar uma persistência única, mais forte e previsível para as configurações usadas ao iniciar os jogos, sem misturá-la com progresso da rodada ou com regras especiais como Foco Vermelho.

O usuário deve abrir uma lista e encontrar a última configuração apropriada sem reorganizar modo, direção, ordem e filtros toda vez.

## Não objetivos

- Não substituir `study_sessions`, que continua responsável por card atual, fila, respostas, acertos e erros.
- Não persistir Foco Vermelho como padrão automático.
- Não alterar as regras de repetição, pontuação ou conclusão.
- Não criar configurações por pasta, turma ou instituição nesta entrega.
- Não alterar preferências de atalhos, aparência, áudio global ou painel de explicações.

## Abordagem escolhida

A solução será **global com substituição por lista**.

Cada usuário terá:

1. um preset global;
2. opcionalmente, um preset específico para cada lista;
3. alterações temporárias da sessão, vindas de URL, metas, atividades ou links.

A ordem de resolução será:

```text
padrões seguros do app
→ preset global do usuário
→ substituição da lista
→ override temporário da URL/sessão
```

A URL tem prioridade durante a sessão, mas nunca será salva automaticamente como preferência permanente.

## Campos persistidos

```ts
type StudyPreset = {
  mode: "flip" | "write" | "multiple-choice" | "unscramble" | "mixed" | "pronunciation";
  direction: "a-b" | "b-a" | "any";
  order: "random" | "sequential";
  scope: "all" | "favorites";
  fastMode: boolean;
};
```

Regras:

- `fastMode` é lembrado, mas só produz efeito nos modos que o suportam.
- `scope: favorites` pode permanecer salvo mesmo quando a lista ainda não tem favoritos; nessa situação a sessão usa `all` como fallback visual sem apagar a preferência.
- Foco Vermelho é escolha especial da sessão, força ordem sequencial e não é incluído no preset.
- Modo e direção enviados por uma atividade ou URL valem apenas para aquela entrada, a menos que o usuário os altere manualmente na interface.

## Modelo de dados

Serão usadas duas tabelas no Supabase de dados de produção.

### `user_study_preferences`

Uma linha global por usuário.

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `mode text not null`
- `direction text not null`
- `card_order text not null`
- `scope text not null`
- `fast_mode boolean not null`
- `updated_at timestamptz not null default now()`

### `user_list_study_preferences`

Uma linha opcional por usuário e lista.

- `user_id uuid not null references auth.users(id) on delete cascade`
- `list_id uuid not null references public.lists(id) on delete cascade`
- `mode text null`
- `direction text null`
- `card_order text null`
- `scope text null`
- `fast_mode boolean null`
- `updated_at timestamptz not null default now()`
- `primary key (user_id, list_id)`

Os campos da tabela por lista são anuláveis porque representam apenas diferenças em relação ao preset global. Uma linha sem diferenças deve ser removida.

As duas tabelas terão RLS, acesso apenas para `authenticated` e políticas baseadas em `(select auth.uid()) = user_id` para `SELECT`, `INSERT`, `UPDATE` e `DELETE`.

## Fonte de verdade e cache

- Supabase é a fonte persistente oficial para usuários autenticados.
- `localStorage` é cache imediato, fallback offline e compatibilidade com o sistema atual.
- O cache será versionado e isolado por usuário e lista.
- Usuários anônimos continuam apenas com `localStorage`.

Chaves propostas:

```text
studyPreferences:v3:<userId>:global
studyPreferences:v3:<userId>:list:<listId>
studyPreferences:v3:<userId>:pending
```

## Migração do sistema atual

Na primeira carga autenticada:

1. normalizar o valor atual de `studyPreferences:<userId>`;
2. consultar o preset global no Supabase;
3. se já existir linha no banco, o banco vence e atualiza o cache;
4. se não existir, importar o preset local existente para o banco;
5. manter leitura compatível da versão antiga por uma janela de migração;
6. não criar substituições por lista a partir do valor antigo, pois o armazenamento atual é global.

Os padrões para usuários sem valor anterior permanecem compatíveis com o comportamento atual:

```text
mode: flip
direction: any
order: random
scope: all
fastMode: false
```

## Separação entre preferência e sessão

O hook atual será dividido conceitualmente em:

- `persistedGlobal`: preset global carregado/cacheado;
- `persistedListOverride`: diferenças da lista atual;
- `sessionOverrides`: valores temporários da URL;
- `effectivePreset`: resultado final usado pela tela e pelo motor.

Alterar `sessionOverrides` nunca chama o repositório de persistência.

Alterar manualmente um seletor no Hub ou nas Configurações da Sessão grava o preset correspondente.

## Comportamento da interface

### Hub de Jogos em uma lista privada

- inicia com o preset efetivo já resolvido;
- mostra um indicador discreto: `Padrão global` ou `Personalizado nesta lista`;
- mudanças de modo, direção, ordem, favoritos e Fast Mode são salvas como substituição da lista;
- oferece `Restaurar padrão global nesta lista`, que remove a linha de override;
- oferece `Usar estas configurações como padrão global`, que atualiza o global e remove o override atual quando os valores forem iguais.

### Coleções e rotas sem lista

Usam o preset global. Alterações manuais nessas telas atualizam o global.

### Rotas públicas, portal e atividades por link

- URL continua tendo prioridade;
- nenhuma preferência permanente é escrita apenas por abrir o link;
- uma alteração manual feita por usuário autenticado pode ser persistida somente quando a rota representar uma lista privada editável;
- usuários anônimos salvam apenas no cache local anônimo.

### Configurações durante o jogo

- ordem, favoritos e Fast Mode continuam ajustáveis;
- alterações manuais persistem no mesmo escopo usado para iniciar a sessão;
- inverter lado deixa de alterar apenas a URL e passa a atualizar a preferência da lista quando a ação for manual;
- Foco Vermelho continua temporário e separado.

## Escritas, sincronização e falhas

- A interface atualiza o cache local imediatamente.
- Escritas no Supabase usam `upsert` e debounce curto para evitar chamadas em sequência.
- Falha de rede não desfaz a escolha visual; a alteração fica marcada em `pending` e é reenviada no próximo `online`, login ou montagem do hook.
- Erro de permissão ou schema ausente gera fallback para `localStorage` e diagnóstico em desenvolvimento, sem quebrar o jogo.
- Ao trocar de conta, cache, fila pendente e preferências efetivas são isolados pelo `user_id`.
- Em conflitos entre dispositivos, a última gravação confirmada pelo Supabase vence.

## Componentes e responsabilidades

### `studyPreset.ts`

Define tipos, defaults, validação, normalização, merge e cálculo de diferenças.

### `studyPreferenceRepository.ts`

Lê, grava e remove global/override no Supabase. Não conhece React nem URL.

### `studyPreferenceCache.ts`

Gerencia cache local versionado, migração v2 → v3 e fila pendente.

### `useStudyPreferences.ts`

Orquestra autenticação, cache, banco e override temporário. Expõe:

```ts
{
  effectivePreset,
  globalPreset,
  listOverride,
  source,
  isHydrating,
  updateForCurrentScope,
  saveAsGlobal,
  resetListOverride,
  setSessionOverrides
}
```

### `GamesHub.tsx` e `Study.tsx`

Consomem o preset efetivo e deixam de decidir por conta própria qual valor da URL deve ser salvo.

## Compatibilidade com o motor

O motor continua recebendo:

- modo normalizado;
- direção efetiva;
- ordem efetiva;
- escopo efetivo;
- Fast Mode.

Não haverá alteração no formato de `study_sessions` nesta entrega. O preset define como uma nova sessão começa; a sessão persistida continua definindo onde o usuário parou.

## Testes obrigatórios

### Unitários

- normalização de valores inválidos;
- migração de localStorage v2 para v3;
- merge defaults → global → lista → URL;
- URL não altera valores persistidos;
- cálculo de override mínimo;
- reset de override;
- Foco Vermelho ausente do modelo;
- isolamento por usuário/lista;
- fila pendente offline.

### Integração

- Hub carrega global quando não há override;
- lista personalizada vence global;
- modo escolhido é lembrado ao voltar;
- direção escolhida é lembrada ao voltar;
- ordem, favoritos e Fast Mode são lembrados;
- link com `?mode=` e `?dir=` não altera o preset salvo;
- logout/login não mistura contas;
- ausência temporária da migration não quebra o estudo.

### Regressão

- Foco Vermelho continua sequencial, único e sem repetição;
- retomada de `study_sessions` continua funcionando;
- metas, turma pública e portal continuam respeitando parâmetros temporários;
- favoritos sem cards disponíveis continuam com fallback seguro.

## Rollout

1. migration e tipos;
2. módulos puros e testes;
3. repositório e cache com fallback;
4. refatoração de `useStudyPreferences`;
5. integração no Hub de Jogos;
6. integração nas Configurações da Sessão;
7. testes gerais, typecheck, lint e build;
8. aplicação manual da migration no Supabase `ymahldldyxvwjeruaxpr` se o deploy não for automático;
9. preview no Lovable e publicação.

## Critérios de conclusão

- Reabrir a mesma lista recupera modo, direção, ordem, escopo e Fast Mode.
- Uma lista personalizada não altera as demais.
- Restaurar padrão global remove a personalização.
- Preferências acompanham a conta em outro dispositivo depois da sincronização.
- Abrir uma atividade por URL não contamina preferências permanentes.
- Funciona offline com sincronização posterior.
- O app continua funcional mesmo antes da migration, usando o fallback local.
- Todos os checks do repositório ficam verdes antes do merge.

## Riscos e rollback

O maior risco é confundir override temporário da URL com uma escolha permanente. A separação entre `sessionOverrides` e persistência é requisito de arquitetura e terá testes próprios.

O frontend terá fallback local caso as tabelas não existam. O rollback do código restaura o hook anterior sem apagar preferências locais. As tabelas são aditivas e podem permanecer no banco sem afetar outras funcionalidades.