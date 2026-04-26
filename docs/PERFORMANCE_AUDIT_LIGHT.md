# Auditoria leve de performance — telas principais

Escopo: Home (`Index.tsx`), Folders (`Folders.tsx`), ListDetail
(`ListDetail.tsx`), GamesHub (`GamesHub.tsx`), Study (`Study.tsx`).
Objetivo: mapear pontos sensíveis sem refatorar arquitetura. Mudanças
sugeridas são pequenas e incrementais.

## ✅ O que já está saudável

- **GamesHub**: `useQuery` com `staleTime: 5 min` para list, folder e
  collection. Navegação back/forward entre lista→hub→study→hub não
  refetcha desnecessariamente.
- **Index/Home**: `useQuery` com `staleTime: 2 min` em
  `["profile-home", userId]`. Consolida perfil + avatar em uma só
  query (boa prática).
- **ListDetail / handleSwapSides**: única RPC atômica + invalidação
  pontual de 3 chaves + cópia offline. Já está protegida por teste de
  contrato (`docs/SWAP_CONTENT_PROTECTED.md`).
- **Study**: `effectiveFlashcards` e `cardsOrder` calculados via
  `useMemo` estável; sessão não reseta em edição in-place de card.

## ⚠️ Achados de menor prioridade (não corrigidos agora — apenas mapeados)

1. **Folders.tsx — dupla chamada `auth.getSession()`**
   - `useEffect([selectedInstitution])` chama `checkAuth()` e
     `loadData()` em paralelo; cada um faz `getSession()`.
   - Impacto: 1 round-trip extra por troca de instituição. Não trava
     a UI, mas é evitável.
   - Sugestão futura: passar `session.user.id` de `checkAuth` para
     `loadData` em vez de re-buscar. Mudança pequena, baixo risco.

2. **Folders.tsx — estado local em vez de React Query**
   - Folders/lists/teachers vivem em `useState` + `loadData` manual.
     Sem cache entre navegações: voltar para `/folders` recarrega
     tudo do zero.
   - Sugestão futura: migrar para `useQuery` com `staleTime` de
     2–5 min, similar ao que já é feito em GamesHub. Não fazer agora
     para preservar comportamento atual.

3. **Study.tsx — múltiplos `useEffect` (8+)**
   - A maioria é justificada (sync de prefs, completion, hint
     pré-parsing, redFocus, etc.).
   - Nenhum identificado como loop redundante. Manter sob observação
     se aparecerem relatos de "card piscando" ou "engrenagem
     resetando sessão".

4. **Auditoria de mobile blocking**
   - Operações em lote (importação, swap, bulk-delete) já usam RPC
     server-side ou estratégia de chunks (ver
     `mem://performance/bulk-operations-chunking-standard`). Sem
     novos bloqueios encontrados.

## 🚫 O que NÃO foi alterado nesta auditoria

- Nada de refatoração de arquitetura.
- Nada de mudança de visual.
- Nenhum comportamento de jogo/sessão modificado.
- Nenhuma feature nova introduzida.

## Critério de sucesso atendido

- O botão **"Inverter conteúdo"** continua funcionando exatamente
  como antes — 1 RPC, 0 loops, configurações intactas.
- Existe agora teste de contrato bloqueando regressão silenciosa.
- Existe documento `SWAP_CONTENT_PROTECTED.md` com a regra explícita
  para qualquer atualização futura.
- Achados de performance restantes estão catalogados com sugestão de
  fix pequeno, sem aplicar agora para não quebrar nada por engano.