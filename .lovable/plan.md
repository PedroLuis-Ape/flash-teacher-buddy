

## Plano: Otimização de Performance Real

### Diagnóstico

Analisei todos os arquivos críticos e encontrei os seguintes gargalos reais que ainda persistem:

---

### Gargalo 1: Chamadas auth redundantes no boot

**Problema**: Na inicialização do app, CINCO componentes/hooks diferentes chamam `supabase.auth.getSession()` ou `supabase.auth.getUser()` em paralelo:
- `SessionWatcher` → `getSession()` + `onAuthStateChange`
- `EconomyContext` → `getSession()` + `hud-summary` edge function + `profiles` query
- `EconomyInitializer` → `getSession()` + daily login check + conversion check
- `Index.tsx` → `getSession()` (checkAuth) + `getUser()` (loadProfileData) + `getUser()` (useQuery profile)
- `GoogleConnectPrompt` → provavelmente mais uma

Isso gera ~8-10 requests de auth só no boot da Home.

**Solução**: Criar um `useAuthUser` hook centralizado com React Query (`staleTime: 5min`) que faz UMA chamada `getSession()` e compartilha o resultado. Todos os componentes consomem desse cache.

---

### Gargalo 2: Index.tsx faz 3 chamadas auth separadas + profile duplicado

**Problema**: `Index.tsx` tem:
- `checkAuth()` → `getSession()` 
- `loadProfileData()` → `getSession()` + query `profiles` (com avatar_skin lookup encadeado)
- `useQuery(['profile'])` → `getUser()` + query `profiles`

São 3 auth calls + 2 profile queries na mesma tela.

**Solução**: Consolidar tudo em um único `useQuery` que busca session + profile completo de uma vez.

---

### Gargalo 3: EconomyContext faz edge function + profile query no boot

**Problema**: `hud-summary` edge function é chamada no init E novamente em `refreshBalance`. Depois faz OUTRA query no `profiles` para xp/level/streak.

**Solução**: Incluir xp_total, level, current_streak no `hud-summary` edge function para eliminar a query extra ao `profiles`. Usar o hook auth centralizado.

---

### Gargalo 4: GamesHub ainda faz 2 queries sequenciais

**Problema**: `loadList()` busca a lista, depois sequencialmente busca a pasta para resolver labels. São 2 queries em cascata.

**Solução**: Usar `Promise.all` para buscar list e folder em paralelo (folder_id é conhecido após a primeira query, mas podemos usar o padrão de fetch condicional).

---

### Gargalo 5: ListDetail não tem virtualização

**Problema**: `MemoizedCardList` renderiza TODOS os cards com `.map()`. Com 100+ cards, o DOM fica pesado em mobile.

**Solução**: Usar o `FlashcardList.tsx` (que já tem `@tanstack/react-virtual`) ou aplicar virtualização diretamente no `MemoizedCardList`.

---

### Implementação

#### Arquivo 1: `src/hooks/useAuthUser.ts` (NOVO)
Hook centralizado com React Query que faz UMA chamada `getSession()` e retorna `{ user, session, isLoading }`. `staleTime: 5min`.

#### Arquivo 2: `src/pages/Index.tsx`
- Remover `checkAuth()`, `loadProfileData()`, e o `useQuery(['profile'])` separado
- Usar `useAuthUser()` para auth
- Consolidar profile loading em um único `useQuery` que busca tudo (first_name, avatar, is_teacher)

#### Arquivo 3: `src/contexts/EconomyContext.tsx`
- Usar `useAuthUser()` em vez de `getSession()` duplicado
- Reduzir para uma única chamada no init

#### Arquivo 4: `src/components/EconomyInitializer.tsx`
- Usar `useAuthUser()` em vez de `getSession()` duplicado

#### Arquivo 5: `src/pages/GamesHub.tsx`
- Remover o `useEffect` separado para `fetchUser` (usar `useAuthUser`)
- Paralelizar list + folder fetch com `Promise.all`

#### Arquivo 6: `src/pages/ListDetail.tsx`
- Substituir `MemoizedCardList` por virtualização usando `@tanstack/react-virtual` (já instalado)
- Manter `FlashcardRow` memo

#### Arquivo 7: `supabase/functions/hud-summary/index.ts`
- Incluir `xp_total`, `level`, `current_streak` na resposta do HUD para eliminar a query extra ao `profiles` no EconomyContext

### Resultado esperado
- Boot: de ~10 auth calls para ~1-2
- Home: de ~8 queries paralelas para ~4
- GamesHub: de 2 queries em cascata para paralelo
- ListDetail com 200+ cards: DOM de ~200 nodes para ~15-20 visíveis
- Economia: 1 edge function call em vez de edge function + profile query

### Segurança
Nenhuma mudança em tabelas, RLS ou schema. Apenas otimização de frontend.

