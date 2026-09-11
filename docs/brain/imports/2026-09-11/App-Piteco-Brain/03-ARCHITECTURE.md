---
cssclasses:
  - ape-ai-note
---

# Architecture

## Stack
**[VERIFICADO-REPO]**
- React 18
- TypeScript 5.8
- Vite 6
- React Router 6
- TanStack React Query
- Supabase JS
- Tailwind CSS
- shadcn/ui + Radix UI
- Vitest
- Playwright
- i18next
- Recharts
- Vaul
- Zod

Não há Framer Motion/Motion listado nas dependências observadas.

## Bootstrap global
**[VERIFICADO-REPO]**
`App.tsx` monta:
`QueryClientProvider`
→ `PerformanceProvider`
→ `AuthProvider`
→ `TooltipProvider`
→ toasters
→ `LazyErrorBoundary`
→ `BrowserRouter`
→ `SessionWatcher`
→ `GlobalLayout`
→ `AuthHydrationGate`
→ `RouteErrorBoundary`
→ `RouteSuspense`
→ `PageTransition`
→ `Routes`.

React Query:
- staleTime 30 s
- gcTime 5 min
- refetchOnWindowFocus false
- retry 1

## Domínios do repo
- `src/pages/` — rotas/superfícies.
- `src/components/` — layout/componentes globais.
- `src/features/study/` — study engine, games, glossário e persistência.
- `src/features/global-import/` — Super Import.
- `src/features/import/` e smart import — ingestão.
- `src/features/collections/`
- `src/features/reinforcement/`
- classroom/turmas.
- `src/integrations/supabase/`
- `src/lib/`
- `supabase/migrations/`
- `supabase/functions/`
- `browser-extension/ape-pronunciation-notes/`
- `scripts/`
- `docs/`.

## Arquivos de alto conflito
- `src/App.tsx`
- `src/pages/Study.tsx`
- `src/pages/MixedStudy.tsx`
- `src/pages/GamesHub.tsx`
- `src/features/study/hooks/useStudyEngine.ts`
- `src/features/study/lib/studySession*`
- `src/features/study/components/InteractiveText*`
- módulos de glossário globais.

Não permitir múltiplos agentes escrevendo nesses arquivos ao mesmo tempo.

## Fonte de verdade
- estado transitório: componente/hook;
- snapshot rápido: localStorage;
- outbox durável: IndexedDB;
- remoto: Supabase;
- código/contratos: GitHub;
- deploy frontend: Lovable.

## Histórico de estabilidade
**[HISTÓRICO — auditoria 14/06/2026]**
Foram encontrados, na época:
- side effects de economia em algumas rotas públicas;
- `SessionWatcher` acumulando auth + route guard;
- splash mínimo artificial;
- limpezas globais de cache/storage;
- risco de falso freeze.
Revalidar antes de tratar como bug atual.
