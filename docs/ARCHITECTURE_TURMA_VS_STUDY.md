# Arquitetura: Turma vs Estudo

> **Regra central:** Turma é contexto. Estudo é motor.

---

## A. EXCLUSIVAS DE TURMA (`src/features/classroom/`)

Funcionalidades que só existem no contexto professor–aluno–turma:

| Funcionalidade | Hook/Componente | Localização |
|---|---|---|
| CRUD Turmas | `useTurmas.ts` | `features/classroom/hooks/` |
| Matrícula/remoção de membros | `useTurmas.ts` (useEnrollAluno, useRemoveTurmaMember) | `features/classroom/hooks/` |
| Atribuições (tarefas) | `useAtribuicoes.ts` | `features/classroom/hooks/` |
| Meus Alunos (professor) | `useMeusAlunos.ts` | `features/classroom/hooks/` |
| Metas de Turma (class_goals) | `useClassGoals.ts` | `features/classroom/hooks/` |
| Avisos da turma | `useAvisos.ts` | `features/classroom/hooks/` |
| Atividade do aluno na turma | `useTurmaActivity.ts` | `features/classroom/hooks/` |
| Painel do professor | `TurmaActivityPanel.tsx` | `features/classroom/components/` |
| Cards de turma (UI) | `TurmasCard.tsx`, `MeusAlunosCard.tsx` | `features/classroom/components/` |
| Mensagens de turma | `useMensagens.ts` | `hooks/` (edge functions) |
| Progresso pedagógico formal | `atribuicoes_status` (tabela) | RLS por turma |

### Tabelas exclusivas de turma:
- `turmas`, `turma_membros`, `turma_student_activity`
- `atribuicoes`, `atribuicoes_status`
- `class_goals`, `class_goal_assignments`, `class_goal_targets`
- `mensagens`, `mensagens_leituras`, `dms`
- `announcements`

---

## B. GERAIS DE ESTUDO (`src/features/study/`)

Motor de estudo reutilizável em qualquer contexto:

| Funcionalidade | Hook/Componente | Localização |
|---|---|---|
| Motor de estudo (engine) | `useStudyEngine.ts` | `features/study/hooks/` |
| Lógica pura do jogo | `gameCore.ts` | `features/study/lib/` |
| Resolução de lados (A/B) | `resolveStudySides.ts` | `features/study/lib/` |
| Config por tipo de estudo | `studyTypeConfig.ts` | `features/study/lib/` |
| Word hints (tooltip) | `wordHints.ts`, `InteractiveText.tsx` | `features/study/lib/`, `features/study/components/` |
| Virar Cartas | `FlipStudyView.tsx` | `features/study/components/` |
| Escrever | `WriteStudyView.tsx` | `features/study/components/` |
| Múltipla Escolha | `MultipleChoiceStudyView.tsx` | `features/study/components/` |
| Desembaralhar | `UnscrambleStudyView.tsx` | `features/study/components/` |
| Pronúncia | `PronunciationStudyView.tsx` | `features/study/components/` |
| TTS | `useTTS.ts`, `speech.ts`, `edgeTTS.ts` | `features/study/hooks/`, `lib/` |
| Favoritos (scoped) | `useFavorites.ts` | `hooks/` |
| Atividade por lista | `useListActivity.ts` | `hooks/` |
| Metas pessoais | `useGoals.ts` | `hooks/` |
| Progresso de flashcard | `flashcard_progress` (tabela) | RLS por user |
| Sessões de estudo | `study_sessions` (tabela) | RLS por user |
| Offline por lista | `offlineStore.ts` | `lib/` |
| Efeitos sonoros | `sfx.ts`, `AudioService.ts` | `lib/` |

---

## C. PONTO DE INTEGRAÇÃO

O único ponto onde turma toca o motor de estudo:

```
useStudyEngine
  ├── useListActivity (geral — sempre ativo)
  └── useTurmaActivity (turma — ativo SOMENTE se lista tem class_id)
```

**Design:** `useTurmaActivity.initTurmaTracking(listId)` descobre automaticamente se a lista pertence a uma turma (via `class_id`). Se não pertence, o tracking de turma é no-op. Zero acoplamento.

---

## D. ISOLAMENTO DE DADOS

| Dado | Pessoal | Turma | Isolamento |
|---|---|---|---|
| Favoritos | `user_favorites` scoped por `listId` | Mesmo mecanismo, mas `listId` é da turma | ✅ Escopo por lista impede mistura |
| Progresso | `flashcard_progress` por user+list | `turma_student_activity` por turma | ✅ Tabelas separadas |
| Metas | `user_goals` + `user_goal_steps` | `class_goals` + `class_goal_assignments` | ✅ Tabelas e hooks separados |
| Cards | `flashcards` com `list_id` pessoal | `flashcards` com `list_id` de turma (via `class_id`) | ✅ RLS por `class_id` |
| Conteúdo | `folders`/`lists` com `visibility=private` | `folders`/`lists` com `visibility=class` + `class_id` | ✅ RLS + filtro `class_id IS NULL` |

---

## E. CONCLUSÃO

A arquitetura já segue o padrão correto:
- **Motor de estudo** é 100% reutilizável (funciona idêntico dentro e fora da turma)
- **Contexto de turma** injeta apenas: origem dos dados, permissões, vínculo pedagógico
- **Sem duplicação** de lógica entre versão "turma" e "pessoal"
- **Dados isolados** por tabelas e escopos diferentes

### Refatoração aplicada:
- `useClassGoals` → movido para `features/classroom/hooks/`
- `useAvisos` → movido para `features/classroom/hooks/`
- `useTurmaActivity` → movido para `features/classroom/hooks/`
- Re-exports mantidos em `src/hooks/` para backward compatibility
