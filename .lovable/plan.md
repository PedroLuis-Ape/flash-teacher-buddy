
# Relatório de Análise: Bugs e Problemas Visuais

## Resumo Executivo
Após análise do código, identifiquei **14 pontos de atenção** divididos entre bugs funcionais, problemas visuais e oportunidades de melhoria.

---

## 🐛 BUGS FUNCIONAIS

### 1. **PageTransition pode causar flickering**
**Arquivo:** `src/components/PageTransition.tsx`
**Problema:** A lógica de transição usa dois `useEffect` conflitantes - um que espera 150ms para atualizar `displayChildren` e outro que atualiza imediatamente.
**Impacto:** Pode causar flash de conteúdo antigo durante navegação.
```text
Linha 17-24: Define timer de 150ms
Linha 26-28: Atualiza imediatamente (contradiz a lógica anterior)
```

### 2. **Scroll na TurmaActivityPanel pode não funcionar em iOS**
**Arquivo:** `src/components/TurmaActivityPanel.tsx`
**Problema:** Altura fixa de `h-[350px]` com ScrollArea pode ter problemas em dispositivos iOS por causa do comportamento de scroll.
**Impacto:** Usuários no iPhone podem não conseguir fazer scroll completo da lista de alunos.

### 3. **Swipe Navigation interfere com scrolls horizontais**
**Arquivo:** `src/hooks/useSwipeNavigation.ts`
**Problema:** O threshold de 100px pode capturar swipes em carrosséis, sliders ou áreas com scroll horizontal.
**Impacto:** Navegação acidental ao interagir com elementos que têm scroll horizontal.

### 4. **Estado de Loading duplicado em Study.tsx**
**Arquivo:** `src/pages/Study.tsx`
**Problema:** Há verificação de `loading || studyLoading` mas ambos são controlados de forma independente.
**Impacto:** Potencial flash de "Carregando..." seguido de conteúdo parcial.

---

## 🎨 PROBLEMAS VISUAIS

### 5. **Version Badge no Auth está com opacity muito baixa**
**Arquivo:** `src/pages/Auth.tsx` (linha 238)
**Problema:** Badge tem `opacity-10` que torna praticamente invisível.
```tsx
className="bg-primary/20 backdrop-blur-sm px-8 py-3 rounded-full border border-primary/30 shadow-lg opacity-10"
```
**Sugestão:** Aumentar para `opacity-50` ou `opacity-30`.

### 6. **Tab Bar pode ter sobreposição de conteúdo**
**Arquivo:** `src/components/GlobalLayout.tsx` (linha 70)
**Problema:** Padding bottom de `pb-20` pode não ser suficiente em dispositivos com home indicator (iPhone X+).
**Impacto:** Botões de ação podem ficar parcialmente escondidos atrás da Tab Bar.

### 7. **Animação de glow na TabBar pode ser intensiva**
**Arquivo:** `src/components/ape/ApeTabBar.tsx` (linha 69)
**Problema:** `animate-pulse` com `blur-md` pode consumir muita GPU em dispositivos mais fracos.
```tsx
<div className="absolute inset-0 bg-primary/20 blur-md rounded-full animate-pulse" />
```

### 8. **Cards hover effect pode não funcionar bem em touch**
**Arquivo:** `src/components/ape/ApeCardFolder.tsx`
**Problema:** Estados `:hover` são mantidos em touch devices após tap.
**Impacto:** Card permanece com estilo "elevado" após toque no mobile.

---

## ⚠️ AVISOS DE SEGURANÇA (do Linter)

### 9. **6 políticas RLS permissivas demais**
**Problema:** Existem políticas com `USING (true)` ou `WITH CHECK (true)` para operações de UPDATE/DELETE/INSERT.
**Impacto:** Potencial risco de segurança - qualquer usuário pode modificar dados.
**Recomendação:** Revisar e restringir as políticas RLS conforme necessidade.

### 10. **Proteção de senha vazada desabilitada**
**Problema:** A funcionalidade de verificar senhas vazadas está desativada no Supabase.
**Impacto:** Usuários podem usar senhas comprometidas.

---

## 🔧 OPORTUNIDADES DE MELHORIA

### 11. **Breadcrumbs não estão sendo usados**
**Arquivo:** `src/components/Breadcrumbs.tsx` foi criado mas não é renderizado em nenhuma página.
**Status:** Componente órfão.

### 12. **Skeleton components subutilizados**
**Arquivo:** `src/components/ui/skeleton-card.tsx`
**Problema:** Componentes `SkeletonCard` e `SkeletonGrid` foram criados mas não são usados nas páginas principais.
**Páginas que poderiam usar:** Folders.tsx, Index.tsx, TurmaDetail.tsx.

### 13. **Safe area bottom inconsistente**
**Arquivos:** `index.css` e `ApeTabBar.tsx`
**Problema:** `safe-area-pb` na TabBar + `pb-24` no GlobalLayout pode criar espaçamento excessivo ou insuficiente dependendo do device.

### 14. **Console logs em produção**
**Arquivos:** `Profile.tsx`, `Folder.tsx`, `TurmaActivityPanel.tsx`
**Problema:** Há `console.log` e `console.error` que podem poluir o console em produção.

---

## 📋 PRIORIZAÇÃO SUGERIDA

| Prioridade | Item | Categoria |
|------------|------|-----------|
| 🔴 Alta | #9 - RLS permissivas | Segurança |
| 🔴 Alta | #6 - TabBar sobreposição | UX Mobile |
| 🟡 Média | #1 - PageTransition flicker | UX |
| 🟡 Média | #3 - Swipe interfere scroll | UX Mobile |
| 🟡 Média | #2 - Scroll iOS | UX Mobile |
| 🟢 Baixa | #5 - Version badge opacity | Visual |
| 🟢 Baixa | #11 - Breadcrumbs órfão | Tech Debt |
| 🟢 Baixa | #12 - Skeleton subutilizado | Tech Debt |
| 🟢 Baixa | #14 - Console logs | Tech Debt |

---

## Próximos Passos

Você pode me dizer quais itens quer que eu corrija primeiro, ou posso criar um plano de implementação para resolver todos em ordem de prioridade.
