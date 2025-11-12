# BLOCO 1 - Turmas e Atribuições MVP

## ✅ IMPLANTADO

Este documento detalha a implementação do BLOCO 1 da integração Professor↔Aluno.

## 📋 O QUE FOI IMPLEMENTADO

### 1. Feature Flag
- `classes_enabled: true` em `src/lib/featureFlags.ts`
- Todo o sistema respeita este flag
- Build padrão: `true`

### 2. Modelo de Dados (Database)

#### Perfil (profiles)
- `ape_id` (TEXT UNIQUE): ID público de 8 caracteres alfanuméricos
- `is_teacher` (BOOLEAN): Indica se o usuário é professor

#### Tabelas Criadas

**turmas**
- `id`, `owner_teacher_id`, `nome`, `descricao`, `ativo`, `created_at`, `updated_at`
- RLS: Apenas owner pode CRUD; membros podem read

**turma_membros**
- `id`, `turma_id`, `user_id`, `role` (enum: aluno|professor_assistente), `ativo`, `joined_at`
- RLS: Owner da turma pode CRUD; membros podem read própria relação

**atribuicoes**
- `id`, `turma_id`, `titulo`, `descricao`, `fonte_tipo` (enum: lista|pasta|cardset), `fonte_id`, `data_limite`, `pontos_vale`, `created_at`
- RLS: Owner da turma CRUD; membros da turma read

**atribuicoes_status**
- `id`, `atribuicao_id`, `aluno_id`, `status` (enum: pendente|em_andamento|concluida), `progresso`, `updated_at`
- RLS: Aluno read/update próprio; professor da turma read geral

### 3. Edge Functions (APIs)

Todas exigem autenticação JWT válida:

- **POST /turmas-create**: Cria turma
- **POST /turmas-enroll**: Matricula aluno via ape_id
- **GET /turmas-mine**: Turmas do professor
- **GET /turmas-as-aluno**: Turmas do aluno
- **POST /atribuicoes-create**: Cria atribuição
- **GET /atribuicoes-by-turma?turma_id=**: Atribuições de uma turma
- **GET /atribuicoes-minhas**: Atribuições do aluno
- **POST /atribuicoes-update-status**: Atualiza status/progresso

### 4. Hooks React

**src/hooks/useTurmas.ts**
- `useTurmasMine()`: Busca turmas do professor
- `useTurmasAsAluno()`: Busca turmas do aluno
- `useCreateTurma()`: Cria turma
- `useEnrollAluno()`: Matricula aluno

**src/hooks/useAtribuicoes.ts**
- `useAtribuicoesByTurma(turmaId)`: Atribuições de uma turma
- `useAtribuicoesMinhas()`: Atribuições do aluno
- `useCreateAtribuicao()`: Cria atribuição
- `useUpdateAtribuicaoStatus()`: Atualiza status

### 5. Componentes UI

**Páginas**
- `src/pages/TurmasProfessor.tsx`: Interface do professor
  - Lista turmas
  - Criar turma
  - Matricular aluno por APE ID
  - Ver atribuições

- `src/pages/TurmasAluno.tsx`: Interface do aluno
  - Lista turmas matriculadas
  - Lista atribuições com status
  - Barra de progresso
  - Abrir atribuições

**Componentes**
- `src/components/TurmasCard.tsx`: Card na home que redireciona para professor ou aluno

**Rotas**
- `/turmas/professor`: Interface do professor
- `/turmas/aluno`: Interface do aluno

### 6. Integração na Home
- Card "Minhas Turmas" aparece na seção Quick Actions
- Redireciona para interface apropriada (professor/aluno) baseado no `is_teacher`

## 🔐 Segurança

### RLS Policies
- Professores só veem/editam suas próprias turmas
- Alunos só veem turmas onde estão matriculados
- Atribuições seguem permissões da turma
- Status individual protegido por aluno

### Helper Functions
- `is_turma_owner(_turma_id, _user_id)`: Verifica ownership
- `is_turma_member(_turma_id, _user_id)`: Verifica membership
- `generate_ape_id()`: Gera IDs únicos
- `set_ape_id()`: Trigger para auto-gerar APE ID

## 📊 Sistema de Pontos

### Atribuições
- `pontos_vale`: Default 50 (editável)
- Ao marcar como "concluída", pontos são creditados:
  - `pts_weekly` += pontos_vale
  - `xp_total` += pontos_vale

### Telemetria
Eventos registrados:
- Criar turma
- Matricular aluno
- Criar atribuição
- Concluir atribuição (com pontos)

## 🧪 Testes de Aceitação

### Como Testar

#### 1. Professor
1. Marcar `is_teacher = true` no perfil via SQL:
   ```sql
   UPDATE profiles SET is_teacher = true WHERE id = 'seu-user-id';
   ```
2. Acessar home, clicar em "Minhas Turmas"
3. Criar turma
4. Copiar APE ID de um aluno
5. Matricular aluno via APE ID
6. Criar atribuição linkando uma lista existente

#### 2. Aluno
1. Acessar home, clicar em "Turmas"
2. Ver turmas matriculadas
3. Ver atribuições
4. Clicar em "Abrir" para acessar conteúdo
5. Marcar progresso/status
6. Verificar pontos creditados ao concluir

#### 3. Regressão
- Navegação básica intacta
- Estudar, Biblioteca, Loja, Perfil funcionando
- Nenhum erro 401 nos logs

## 📁 Arquivos Criados/Modificados

### Database
- Migration: `supabase/migrations/[timestamp]_bloco1_turmas.sql`

### Edge Functions
- `supabase/functions/turmas-create/index.ts`
- `supabase/functions/turmas-enroll/index.ts`
- `supabase/functions/turmas-mine/index.ts`
- `supabase/functions/turmas-as-aluno/index.ts`
- `supabase/functions/atribuicoes-create/index.ts`
- `supabase/functions/atribuicoes-by-turma/index.ts`
- `supabase/functions/atribuicoes-minhas/index.ts`
- `supabase/functions/atribuicoes-update-status/index.ts`

### Frontend
- `src/hooks/useTurmas.ts`
- `src/hooks/useAtribuicoes.ts`
- `src/pages/TurmasProfessor.tsx`
- `src/pages/TurmasAluno.tsx`
- `src/components/TurmasCard.tsx`
- `src/lib/featureFlags.ts` (modificado)
- `src/App.tsx` (modificado)
- `src/pages/Index.tsx` (modificado)

## 🚀 Próximos Passos (BLOCO 2)

Aguardando instruções para:
- Sistema de mensagens e comentários
- Notificações
- Threads de discussão
- Chat entre professor e aluno

## 🔍 Geração de APE ID

APE IDs são gerados automaticamente ao criar perfil:
- 8 caracteres alfanuméricos
- Maiúsculas
- Únicos no sistema
- Usados para matricular alunos sem expor user_id

Exemplo: `A1B2C3D4`

## ⚠️ Importante

- Sem chamadas sem JWT válido
- Zero erros 401 quando flag OFF
- Nenhuma function `notifications-*`
- Sistema de pontos integrado ao existente
- Regressão: tudo funcionando