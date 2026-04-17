

## Diagnóstico real (em ordem de gravidade)

### Bug 1: tela "Carregando..." infinita ao iniciar qualquer modo de jogo

**Onde**: `src/pages/Study.tsx`, linha 571.

A condição de loading é:
```ts
if (loading || studyLoading || (favoritesOnly && favoritesLoading)) {
  return <p>Carregando...</p>;
}
```

Onde `studyLoading` vem de `useStudyEngine` (`isLoading` interno).

**Por que trava**: Em `useStudyEngine.ts` (linha 207):
```ts
const initializeSession = useCallback(async () => {
  const initKey = `${listId}|${mode}|${cardsSignature}`;
  if (lastInitSignatureRef.current === initKey) {
    return; // ← sai SEM mudar isLoading
  }
  if (flashcards.length === 0) {
    setIsLoading(false);
    return;
  }
  lastInitSignatureRef.current = initKey;
  ...
```

`isLoading` começa como `true`. Esse hook é chamado pelo `Study.tsx` antes de `loadFlashcards()` terminar — então `flashcards` é `[]`, `cardsSignature` é `""`, e o efeito da linha 830 dispara `initializeSession()`. A primeira execução cai no `flashcards.length === 0` → seta `isLoading=false` ✓.

Mas em seguida, novos `useEffect` de `Study.tsx` (linhas 211-223) disparam `setGameSettings(...)` toda vez que `prefs` mudam. Isso **não** reinicializa o engine, mas: o `useEffect` da linha 830 depende de `[listId, cardsSignature, mode]`. Quando `loadFlashcards` finalmente popula `setFlashcards(orderedData)`, `cardsSignature` muda, o efeito reroda, **mas** se `listId` ainda for `undefined` no primeiro render (rota é `/collection/:collectionId`, não `/list/:id`), a chave `initKey` fica `"undefined|write|<sig>"`. Tudo bem na 1ª vez. O problema é o `early return` quando o efeito reroda com a **mesma** signature: `lastInitSignatureRef.current === initKey` → retorna sem mexer em `isLoading`. Combinado com o `useEffect` da linha 217 que faz `setGameSettings` repetidamente (a função `setGameSettings` muda de identidade a cada render do hook), há re-render em loop que mantém `isLoading=true` em casos onde `flashcards.length > 0` mas a init não chegou a executar de fato.

Mas o ponto mais grave: **na linha 217-223 o `useEffect` tem `setGameSettings` como dependência**. `setGameSettings` é o setter de `useState`, que tem identidade estável — não é o problema. O problema real é mais simples: depois de `setGameSettings({...})`, o engine **não re-inicializa**, então `cardsOrder` segue `[]`. A condição `currentCard` (linha 864) vira `null`, e `Study.tsx` linha 597 (`if (!currentCard)`) deveria mostrar fallback. Mas esse fallback exige `loading === false && studyLoading === false`. Se `studyLoading` ficar travado em `true` por causa do early return de `initializeSession`, o usuário fica vendo "Carregando..." para sempre.

**Causa raiz confirmada**: o `early return` da linha 210-212 do `useStudyEngine.ts` não chama `setIsLoading(false)`. Em qualquer cenário onde a signature já bate (re-render por outro motivo enquanto cards ainda não foram carregados), o `isLoading` interno fica preso.

Adicionalmente, o `useEffect` da linha 217-223 do `Study.tsx` chama `setGameSettings` em **todo render** onde `prefs` ainda não convergiram, criando re-renders extras que agravam o problema.

### Bug 2: a publicação não sobe pro domínio

**Hipótese**: Não tenho prova que o build novo não chegue ao domínio. Precisamos confirmar com o badge de versão (já implementado em `GlobalLayout.tsx`).

O badge mostra `v2.5.0 · <últimos 6 dígitos do build_id>`. Se você publicar agora e os últimos 6 dígitos **não mudarem** entre preview e domínio público, o problema é deploy/cache de CDN. Se mudarem mas o bug continuar, o problema é exclusivamente código.

Pelo que sei do estado atual:
- VitePWA está desativado em `vite.config.ts` ✓
- `public/sw.js` é um Service Worker auto-destrutivo ✓
- Manifest PWA está fora do `index.html` ✓

Esses 3 pontos já matam a hipótese de cache de PWA. Falta apenas verificar empiricamente o build_id nos dois ambientes.

---

## Plano de correção (mínimo, incremental)

### Etapa 1 — Corrigir o loading infinito do jogo (causa raiz)

**Arquivo**: `src/features/study/hooks/useStudyEngine.ts`

Mudança cirúrgica em `initializeSession` (linha 208-212): garantir que `setIsLoading(false)` seja chamado também no early return de signature duplicada, **se já houver cards carregados**:

```ts
const initKey = `${listId}|${mode}|${cardsSignature}`;
if (lastInitSignatureRef.current === initKey) {
  // Init já foi feita para esta combinação — destrava o loading
  if (flashcards.length > 0) {
    setIsLoading(false);
  }
  return;
}
```

### Etapa 2 — Evitar `setGameSettings` em loop por mudança de prefs

**Arquivo**: `src/pages/Study.tsx`, linhas 217-223.

O `useEffect` atual chama `setGameSettings` toda vez que `prefs.order/favoritesOnly/fastMode` mudam. Após a init do engine, isso pode reescrever as settings e gerar re-renders. Adicionar guard para só sincronizar enquanto `loading === true` (ou seja, antes da primeira renderização real do jogo). Depois disso, as mudanças vêm pelo `handleSettingsChange` (linha 487), que é o caminho controlado.

```ts
useEffect(() => {
  if (!loading) return; // só sincroniza durante a fase inicial
  setGameSettings({
    mode: prefs.order === "sequential" ? "sequential" : "random",
    subset: prefs.favoritesOnly ? "favorites" : "all",
    fastMode: prefs.fastMode,
  });
}, [prefs.order, prefs.favoritesOnly, prefs.fastMode, loading, setGameSettings]);
```

### Etapa 3 — Verificar se o domínio recebe a build nova

Sem mexer em código. Após as etapas 1 e 2 serem aplicadas e a Lovable buildar:

1. Abra `https://www.apeeducation.org/?t=999999` em aba anônima.
2. Olhe o badge no canto inferior. Anote os 6 últimos dígitos.
3. Abra o preview Lovable. Anote os 6 últimos dígitos.
4. Se forem **iguais** → deploy está OK, a correção dos jogos já resolve tudo.
5. Se forem **diferentes** → é problema de CDN/deploy (não-código), e abrimos uma segunda investigação focada em headers de cache do hosting.

### Etapa 4 (somente se Etapa 3 mostrar build_id diferentes)

Investigar:
- O Service Worker antigo em `/sw.js` no domínio público está sendo substituído pelo novo `public/sw.js` auto-destrutivo? (Pode haver cache-control agressivo no `sw.js` antigo segurando ele.)
- Headers de `Cache-Control` no `index.html` servido pelo hosting Lovable.

Não vou propor mudanças de código aqui agora porque seria especulação. Decidimos depois do resultado empírico da Etapa 3.

---

## Arquivos que serão alterados nesta rodada

1. `src/features/study/hooks/useStudyEngine.ts` — 4 linhas no `initializeSession`.
2. `src/pages/Study.tsx` — 2 linhas no `useEffect` de sync de gameSettings.

Nada mais. Nada de reescrever, nada de PWA, nada de versionManager, nada de SafeMode. Só o bug real do loading infinito.

