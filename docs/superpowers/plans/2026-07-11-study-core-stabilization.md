# Study Core Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir as regressões críticas do núcleo de estudo, tornar Foco Vermelho independente de Favoritos, introduzir políticas puras e testáveis de escopo/fila e impedir novos merges sem validação automática.

**Architecture:** A primeira entrega preserva o motor atual, mas extrai decisões de escopo e fila para módulos puros. `Study.tsx` continua orquestrando a tela, enquanto filtros e políticas deixam de ser regras inline. `useStudyEngine` mantém persistência e progresso, porém deixa de aplicar repetição vermelha quando o escopo efetivo é Foco Vermelho.

**Tech Stack:** React 18, TypeScript 5.8, Vite 6, Vitest 4, Supabase JS 2, GitHub Actions.

## Global Constraints

- Não alterar economia, valores de recompensa, importadores ou estrutura de dados de produção nesta entrega.
- Não aplicar migrations no projeto Supabase `xrnfhhoxmmstagmelvyi` como se fosse o backend de dados `ymahldldyxvwjeruaxpr`.
- Foco Vermelho deve funcionar sem ativar Favoritos.
- Foco Vermelho deve usar ordem sequencial e cada entrada jogável deve aparecer uma única vez.
- A priorização vermelha antiga só pode existir em Favoritos quando Foco Vermelho estiver desligado.
- Preservar compatibilidade com `subset`, `mode` e `redFocus` enquanto a configuração canônica completa não substitui o contrato legado.
- Toda mudança de comportamento deve começar por teste que falha.
- Merge somente após typecheck, testes, lint e build concluírem com código de saída zero.

---

### Task 1: Barreira geral de qualidade

**Files:**
- Create: `.github/workflows/core-quality.yml`

**Interfaces:**
- Consumes: scripts existentes em `package.json`.
- Produces: check `Core Quality / validate` para pull requests e pushes em `main`.

- [ ] **Step 1: Criar workflow com Node 20 e cache npm**
- [ ] **Step 2: Executar `npm ci`**
- [ ] **Step 3: Executar `npm run typecheck`**
- [ ] **Step 4: Executar `npm run test`**
- [ ] **Step 5: Executar `npm run lint`**
- [ ] **Step 6: Executar `npm run build`**
- [ ] **Step 7: Confirmar execução no pull request**

### Task 2: Restaurar tradução canônica para jogável

**Files:**
- Modify: `src/features/cards/lib/cardStatusIdentity.ts`
- Test: `src/features/cards/lib/cardStatusIdentity.test.ts`

**Interfaces:**
- Consumes: `canonicalIds`, `canonicalToPlayable`.
- Produces: `mapCanonicalIdsToPlayable(...): string[]` deduplicado.

- [ ] **Step 1: Confirmar que os testes existentes falham com retorno global vazio**
- [ ] **Step 2: Traduzir IDs canônicos válidos para IDs jogáveis**
- [ ] **Step 3: Remover duplicatas preservando a ordem dos IDs canônicos**
- [ ] **Step 4: Retornar vazio somente quando a seleção cobre toda a fila jogável**
- [ ] **Step 5: Rodar o arquivo de teste e confirmar aprovação**

### Task 3: Política pura de escopo

**Files:**
- Create: `src/features/study/lib/studyScopePolicy.ts`
- Test: `src/features/study/lib/studyScopePolicy.test.ts`

**Interfaces:**
- Produces: `resolveStudyScope(settings)`, `shouldInjectRedPriority(settings)` e `filterCardsForStudyScope(input)`.

- [ ] **Step 1: Escrever testes para escopos all, favorites e red**
- [ ] **Step 2: Escrever teste em que redFocus funciona com subset all**
- [ ] **Step 3: Escrever teste de card layered marcado pelo parent_card_id**
- [ ] **Step 4: Escrever teste garantindo que redFocus desativa injeção vermelha**
- [ ] **Step 5: Implementar política mínima**
- [ ] **Step 6: Confirmar testes verdes**

### Task 4: Planejador puro de fila

**Files:**
- Create: `src/features/study/lib/studyQueue.ts`
- Test: `src/features/study/lib/studyQueue.test.ts`

**Interfaces:**
- Produces: `buildStudyQueue(input): { queue: string[]; scope: StudyScope }`.

- [ ] **Step 1: Testar preservação da ordem sequencial**
- [ ] **Step 2: Testar deduplicação de entradas jogáveis**
- [ ] **Step 3: Testar Foco Vermelho linear e sem cópias**
- [ ] **Step 4: Testar aleatoriedade determinística com gerador injetado**
- [ ] **Step 5: Implementar Fisher-Yates sem `sort(() => Math.random() - 0.5)`**
- [ ] **Step 6: Confirmar todos os testes do planejador**

### Task 5: Integrar Foco Vermelho independente

**Files:**
- Modify: `src/pages/Study.tsx`
- Modify: `src/features/study/components/GameSettingsModal.impl.tsx`
- Modify: `src/features/study/hooks/useStudyEngine.ts`

**Interfaces:**
- Consumes: helpers de `studyScopePolicy.ts`.
- Produces: Foco Vermelho independente, sequencial e sem repetição extra.

- [ ] **Step 1: Fazer a tela manter um espelho local do subset efetivo para filtragem imediata**
- [ ] **Step 2: Aplicar escopo red antes de qualquer filtro de favoritos**
- [ ] **Step 3: Remover coerção que desliga redFocus quando subset não é favorites**
- [ ] **Step 4: Atualizar modal para ligar redFocus sem ligar Favoritos**
- [ ] **Step 5: Desabilitar ordem aleatória enquanto redFocus estiver ativo**
- [ ] **Step 6: Impedir injeção vermelha durante inicialização e reinício do Foco Vermelho**
- [ ] **Step 7: Preservar priorização vermelha no modo Favoritos sem Foco Vermelho**

### Task 6: Verificação e integração

**Files:**
- Review: todos os arquivos alterados nesta entrega.

- [ ] **Step 1: Rodar testes direcionados**
- [ ] **Step 2: Rodar `npm run typecheck`**
- [ ] **Step 3: Rodar `npm run test`**
- [ ] **Step 4: Rodar `npm run lint`**
- [ ] **Step 5: Rodar `npm run build`**
- [ ] **Step 6: Revisar diff e confirmar ausência de migration Supabase**
- [ ] **Step 7: Fazer squash merge somente com checks verdes**
