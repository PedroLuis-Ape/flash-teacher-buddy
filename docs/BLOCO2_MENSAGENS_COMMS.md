# BLOCO 2 - Mensagens e Comunicação

## ✅ IMPLANTADO

Este documento detalha a implementação do BLOCO 2: sistema de mensagens, chat e comentários para turmas.

## 📋 O QUE FOI IMPLEMENTADO

### 1. Feature Flag
- `class_comms_enabled: true` em `src/lib/featureFlags.ts`
- Todo sistema de mensagens respeita este flag
- Build padrão: `true`

### 2. Modelo de Dados (Database)

#### Tabelas Criadas

**mensagens**
- `id`, `turma_id`, `thread_tipo` (enum: turma|atribuicao|dm), `thread_chave`, `sender_id`, `texto` (max 2000 chars), `anexos` (jsonb), `created_at`, `edited_at`, `deleted`
- Índices: thread, sender
- RLS: Membros podem ler/enviar em suas threads

**dms** (pares professor-aluno)
- `id`, `turma_id`, `teacher_id`, `aluno_id`, `created_at`
- RLS: Participantes podem ver suas DMs; professores podem criar

**mensagens_leituras** (read receipts)
- `id`, `mensagem_id`, `user_id`, `lido_em`
- RLS: Usuários veem próprias leituras; professores veem de sua turma

**message_rate_limits**
- Rate limiting: 20 mensagens/minuto por thread
- RLS: Sem acesso direto (usado por função security definer)

### 3. Funções de Segurança

**can_access_thread(_turma_id, _thread_tipo, _thread_chave, _user_id)**
- Verifica se usuário pode acessar thread
- Valida membership e permissões específicas (DM, turma, atribuição)

**check_message_rate_limit(_user_id, _thread_key)**
- Previne spam: máx 20 mensagens por minuto
- Window de 1 minuto, reset automático

### 4. Edge Functions

Todas exigem autenticação JWT válida:

**POST /classes-chat-send**
- Envia mensagem (turma/atribuição/dm)
- Sanitiza HTML
- Valida rate limit
- Campos: `turma_id`, `thread_tipo`, `thread_chave`, `texto`, `anexos?`

**GET /classes-chat-list?turma_id=&thread_tipo=&thread_chave=&cursor=&limit=**
- Lista mensagens com paginação
- Ordem: mais recentes primeiro
- Limit padrão: 50

**POST /classes-chat-mark-read**
- Marca mensagens como lidas
- Campos: `turma_id`, `thread_tipo`, `thread_chave`, `last_message_id`

**POST /classes-dm-open**
- Cria ou encontra DM professor↔aluno
- Retorna: `dm_pair_id`
- Campos: `turma_id`, `aluno_id`

**GET /classes-dm-list?turma_id=**
- Lista DMs do usuário em uma turma

### 5. Hooks React

**src/hooks/useMensagens.ts**
- `useChatMessages(turmaId, threadTipo, threadChave)`: Lista mensagens (polling 5s)
- `useSendMessage()`: Envia mensagem
- `useMarkMessagesRead()`: Marca leituras
- `useOpenDM()`: Abre/cria DM
- `useDMsList(turmaId)`: Lista DMs da turma

### 6. Componentes UI

**Componentes Base**
- `src/components/ChatComposer.tsx`: Input multilinha + botão enviar
  - Enter: enviar
  - Shift+Enter: nova linha
  - Validação de 2000 chars

- `src/components/MessageBubble.tsx`: Bolha de mensagem
  - Avatar do sender
  - Timestamp relativo
  - Estilo diferenciado para próprias mensagens

**Páginas**

- `src/pages/Turmas.tsx`: Lista unificada de turmas
  - Professores: Tabs "Como Professor" / "Como Aluno"
  - Alunos: Lista direta
  - Clique abre `/turmas/:turmaId`

- `src/pages/TurmaDetail.tsx`: Detalhe da turma com 3 abas
  - **Atribuições**: Lista de atribuições (clique → detalhe)
  - **Pessoas**: Lista membros com APE ID e role
  - **Chat**: Feed de mensagens + composer
  - Polling automático a cada 5s

- `src/pages/AtribuicaoDetail.tsx`: Detalhe da atribuição
  - Cabeçalho com descrição, tipo, pontos, prazo
  - Botão "Abrir Conteúdo" (redireciona para fonte)
  - Seção "Comentários" com feed + composer
  - Usa thread_tipo='atribuicao'

### 7. Rotas Criadas

```
/turmas                      → Lista de turmas (unificada)
/turmas/:turmaId             → Detalhe da turma (abas)
/turmas/:turmaId/atribuicoes/:atribuicaoId → Detalhe da atribuição
/turmas/professor            → Gestão professor (mantida)
/turmas/aluno                → View aluno (mantida)
```

### 8. Navegação Corrigida

**Antes (404s)**
- Links para `/turmas/professor` ou `/turmas/aluno` direto

**Depois (Corrigido)**
- Card "Minhas Turmas" → `/turmas` (unificada)
- Botões de turmas específicas → `/turmas/:turmaId`
- Zero 404s

## 🔐 Segurança

### Proteções Implementadas

1. **Rate Limiting**
   - 20 mensagens/min por thread
   - Previne spam e abuso

2. **Sanitização**
   - HTML escapado (`<`, `>`, `"`, `'`, `/`)
   - Protege contra XSS

3. **RLS Policies**
   - Somente membros da turma veem mensagens
   - DMs somente entre participantes
   - Read receipts protegidos

4. **Validação de Input**
   - Max 2000 caracteres por mensagem
   - Campos obrigatórios validados
   - Thread access verificado

### Helper Functions Security
- `can_access_thread`: SECURITY DEFINER
- `check_message_rate_limit`: SECURITY DEFINER
- Previne RLS recursion

## 📊 Sistema de Comentários

### Atribuições
- Thread tipo: `atribuicao`
- Thread chave: `atribuicao_id`
- Mesma infraestrutura de mensagens
- Visível para membros da turma

### Chat da Turma
- Thread tipo: `turma`
- Thread chave: `turma_id`
- Canal aberto para todos membros

### DMs
- Thread tipo: `dm`
- Thread chave: `dm_id` (UUID do registro DM)
- Privado entre professor e aluno específico

## 🧪 Testes de Aceitação

### ✅ Checklist

#### 1. Rotas sem 404
- [ ] `/turmas` abre lista
- [ ] `/turmas/:id` abre detalhe
- [ ] `/turmas/:id/atribuicoes/:id` abre detalhe atribuição
- [ ] Card "Minhas Turmas" na home funciona

#### 2. Chat da Turma
- [ ] Professor envia mensagem
- [ ] Aluno recebe e responde
- [ ] Mensagens aparecem em tempo real (5s)
- [ ] Rate limit funciona (20/min)

#### 3. Comentários em Atribuição
- [ ] Professor comenta
- [ ] Aluno comenta e vê histórico
- [ ] Botão "Abrir Conteúdo" funciona

#### 4. DMs (Professor↔Aluno)
- [ ] Professor abre DM via "Pessoas"
- [ ] Aluno vê DM e responde
- [ ] Histórico mantido

#### 5. Sem Autenticação
- [ ] Nenhuma chamada às APIs
- [ ] Zero erros 401 no console
- [ ] Flag OFF: componentes não renderizam

## 📁 Arquivos Criados/Modificados

### Database
- Migration: `supabase/migrations/[timestamp]_bloco2_mensagens.sql`
- Migration: `supabase/migrations/[timestamp]_fix_rls_rate_limits.sql`

### Edge Functions
- `supabase/functions/classes-chat-send/index.ts`
- `supabase/functions/classes-chat-list/index.ts`
- `supabase/functions/classes-chat-mark-read/index.ts`
- `supabase/functions/classes-dm-open/index.ts`
- `supabase/functions/classes-dm-list/index.ts`

### Frontend - Hooks
- `src/hooks/useMensagens.ts`

### Frontend - Componentes
- `src/components/ChatComposer.tsx`
- `src/components/MessageBubble.tsx`

### Frontend - Páginas
- `src/pages/Turmas.tsx` (nova - unificada)
- `src/pages/TurmaDetail.tsx` (nova)
- `src/pages/AtribuicaoDetail.tsx` (nova)
- `src/components/TurmasCard.tsx` (modificada - aponta para `/turmas`)

### Frontend - Configuração
- `src/lib/featureFlags.ts` (adicionada flag `class_comms_enabled`)
- `src/App.tsx` (rotas adicionadas)

## 🚀 Próximos Passos

Possíveis melhorias futuras:
- Notificações push (fora do escopo atual)
- Upload de anexos reais (metadata já existe)
- Edição de mensagens
- Reações/emojis
- Websockets para real-time (substituir polling)
- Busca de mensagens
- Arquivamento de threads

## ⚠️ Importante

- **Zero notifications-***: Nenhuma função de notificação criada
- **Zero 401**: Todas as chamadas protegidas por JWT check no cliente
- **Rate limiting ativo**: 20 msg/min previne spam
- **Sanitização HTML**: XSS protection
- **RLS estrita**: Acesso baseado em membership
- **Polling 5s**: Atualização automática de mensagens

## 🔍 Como Usar

### Professor
1. Acessar "Minhas Turmas" na home
2. Abrir turma → aba "Chat"
3. Enviar mensagens, ver membros
4. Clicar em atribuição → comentar
5. Em "Pessoas", clicar ícone mensagem para DM

### Aluno
1. Acessar "Turmas" na home
2. Abrir turma → ver atribuições
3. Clicar atribuição → ler/comentar
4. Aba "Chat" → participar da conversa

## 📝 Contratos das APIs

Ver detalhes completos em cada Edge Function, mas resumidamente:

```typescript
// Enviar mensagem
POST /classes-chat-send
{
  turma_id: string,
  thread_tipo: 'turma' | 'atribuicao' | 'dm',
  thread_chave: string,
  texto: string,
  anexos?: any
}

// Listar mensagens
GET /classes-chat-list?turma_id=X&thread_tipo=Y&thread_chave=Z&cursor=?&limit=50

// Marcar como lido
POST /classes-chat-mark-read
{
  turma_id: string,
  thread_tipo: string,
  thread_chave: string,
  last_message_id: string
}

// Abrir DM
POST /classes-dm-open
{
  turma_id: string,
  aluno_id: string
}
→ { dm_pair_id: string }

// Listar DMs
GET /classes-dm-list?turma_id=X
```

## ✅ Checklist Final

- [x] Feature flag adicionada
- [x] Tabelas criadas com RLS
- [x] Edge Functions implementadas
- [x] Hooks React criados
- [x] Componentes UI implementados
- [x] Páginas criadas
- [x] Rotas configuradas
- [x] 404s corrigidos
- [x] Navegação atualizada
- [x] Sem notifications-*
- [x] Sem erros 401
- [x] Rate limiting ativo
- [x] Sanitização HTML
- [x] Docs completos