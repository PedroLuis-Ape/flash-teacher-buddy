# Sistema de Integração Aluno-Professor - Guia de Reativação

## Status Atual
🔴 **DESATIVADO** - O sistema foi desativado em 2025-11-12 devido a erros 401 persistentes nas Edge Functions de notificações.

## O que foi desativado

### 1. Feature Flag
- `classes_enabled: false` em `src/lib/featureFlags.ts`

### 2. Rotas Removidas
- `/classes` - Gerenciamento de turmas
- `/my-students` - Lista de alunos inscritos
- `/my-teachers` - Professores que o aluno segue
- `/teacher/:teacherId/folders` - Pastas de um professor específico
- `/pesquisar` - Busca de usuários
- `/perfil/:id` - Perfil público de usuário
- `/announcements/:id` - Detalhe de anúncios

### 3. Edge Functions Deletadas
- `notifications-list` - Listagem de notificações do usuário
- `notifications-read` - Marcar notificações como lidas

### 4. Componentes Removidos
- `NotificationsBadge.tsx` - Badge de notificações no header
- `AnnouncementsList.tsx` - Lista de anúncios
- `CreateAnnouncementDialog.tsx` - Dialog para criar anúncios
- `Classes.tsx` - Página de gerenciamento de turmas
- `MyStudents.tsx` - Página de alunos
- `MyTeachers.tsx` - Página de professores
- `TeacherFolders.tsx` - Página de pastas do professor
- `UserSearch.tsx` - Página de busca de usuários
- `AnnouncementDetail.tsx` - Página de detalhe de anúncio
- `PublicProfile.tsx` - Página de perfil público

### 5. Hooks Removidos
- `useNotifications.ts`
- `useClasses.ts`
- `useThreads.ts`
- `useMessages.ts`
- `useAnnouncements.ts`

### 6. Proteção RLS
As seguintes tabelas têm políticas "deny all" ativas:
- `notifications`
- `classes`
- `class_members`
- `announcements`
- `threads`
- `messages`

**IMPORTANTE:** As tabelas NÃO foram deletadas, apenas protegidas. Os dados permanecem intactos.

## Como Reativar

### Passo 1: Ativar o Feature Flag
```typescript
// src/lib/featureFlags.ts
classes_enabled: true,
```

### Passo 2: Recriar as Edge Functions

#### notifications-list
```typescript
// supabase/functions/notifications-list/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado - token ausente' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { 
            Authorization: authHeader,
            apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '',
          },
        },
        auth: {
          persistSession: false,
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const cursor = body.cursor;
    const limit = parseInt(body.limit?.toString() || '20', 10);

    let query = supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      query = query.lt('created_at', cursor);
    }

    const { data: notifications, error } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar notificações' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasMore = notifications.length > limit;
    const items = hasMore ? notifications.slice(0, limit) : notifications;
    const nextCursor = hasMore ? items[items.length - 1].created_at : null;

    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    return new Response(
      JSON.stringify({
        notifications: items,
        next_cursor: nextCursor,
        has_more: hasMore,
        unread_count: unreadCount || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
```

#### notifications-read
Similar ao notifications-list, implementar a função para marcar notificações como lidas.

### Passo 3: Restaurar RLS Policies

Execute a seguinte migração SQL:

```sql
-- Restaurar políticas para notifications
DROP POLICY IF EXISTS "Deny all access to notifications" ON public.notifications;

CREATE POLICY "Users can view their own notifications" 
ON public.notifications 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications" 
ON public.notifications 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);

-- Restaurar políticas para classes
DROP POLICY IF EXISTS "Deny all access to classes" ON public.classes;

CREATE POLICY "Users can view classes they own or are members of"
ON public.classes
FOR SELECT
USING ((owner_id = auth.uid()) OR is_class_member(id, auth.uid()));

CREATE POLICY "Only owners can update their classes"
ON public.classes
FOR UPDATE
USING (owner_id = auth.uid());

CREATE POLICY "Only owners can delete their classes"
ON public.classes
FOR DELETE
USING (owner_id = auth.uid());

-- Restaurar políticas para class_members
DROP POLICY IF EXISTS "Deny all access to class_members" ON public.class_members;

CREATE POLICY "Users can view class members if they are members"
ON public.class_members
FOR SELECT
USING ((user_id = auth.uid()) OR is_class_owner(class_id, auth.uid()));

CREATE POLICY "Class owners can add members"
ON public.class_members
FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM classes
  WHERE classes.id = class_members.class_id
  AND classes.owner_id = auth.uid()
));

CREATE POLICY "Users can remove themselves from classes"
ON public.class_members
FOR DELETE
USING (user_id = auth.uid());

-- Restaurar políticas para announcements
DROP POLICY IF EXISTS "Deny all access to announcements" ON public.announcements;

-- Adicionar policies adequadas para announcements

-- Restaurar políticas para threads e messages
DROP POLICY IF EXISTS "Deny all access to threads" ON public.threads;
DROP POLICY IF EXISTS "Deny all access to messages" ON public.messages;

-- Adicionar policies adequadas para threads e messages
```

### Passo 4: Restaurar Rotas

Descomentar ou adicionar as rotas em `src/App.tsx`:

```typescript
const Classes = lazy(() => import("./pages/Classes"));
const AnnouncementDetail = lazy(() => import("./pages/AnnouncementDetail"));
const PublicProfile = lazy(() => import("./pages/PublicProfile"));
const UserSearch = lazy(() => import("./pages/UserSearch"));
const MyStudents = lazy(() => import("./pages/MyStudents"));
const MyTeachers = lazy(() => import("./pages/MyTeachers"));
const TeacherFolders = lazy(() => import("./pages/TeacherFolders"));

// Nas rotas:
<Route path="/classes" element={<Classes />} />
<Route path="/perfil/:id" element={<PublicProfile />} />
<Route path="/pesquisar" element={<UserSearch />} />
<Route path="/my-students" element={<MyStudents />} />
<Route path="/my-teachers" element={<MyTeachers />} />
<Route path="/teacher/:teacherId/folders" element={<TeacherFolders />} />
<Route path="/announcements/:id" element={<AnnouncementDetail />} />
```

### Passo 5: Recriar Componentes e Hooks

Todos os arquivos deletados precisam ser recriados. Consulte o histórico do git ou backups para recuperar o código original.

### Passo 6: Adicionar NotificationsBadge ao GlobalLayout

```typescript
// src/components/GlobalLayout.tsx
import { NotificationsBadge } from "./NotificationsBadge";

// No header:
<div className="flex items-center gap-4">
  <NotificationsBadge />
  <CurrencyHeader />
  {FEATURE_FLAGS.present_inbox_visible && <PresentBoxBadge />}
</div>
```

## Problemas Conhecidos

### Erro 401 nas Edge Functions
O problema original era que `supabase.auth.getUser()` retornava "Auth session missing!" mesmo quando o Authorization header estava presente.

**Possíveis causas:**
1. Conflito entre `verify_jwt = true` no config.toml e criação manual do cliente
2. Header `apikey` faltando na configuração do cliente
3. Configuração incorreta de CORS

**Solução aplicada (a testar):**
- Remover `verify_jwt = true` do config.toml
- Adicionar `apikey` nos headers globais do cliente Supabase
- Configurar `persistSession: false` nas opções de autenticação

## Testes Obrigatórios Após Reativação

1. ✅ Login de usuário autenticado
2. ✅ Chamada GET a `/functions/v1/notifications-list` deve retornar 200
3. ✅ Chamada POST a `/functions/v1/notifications-read` deve retornar 200
4. ✅ Navegação em `/classes` deve funcionar
5. ✅ Criar turma como professor
6. ✅ Entrar em turma como aluno
7. ✅ Postar anúncio em turma
8. ✅ Receber notificação de anúncio
9. ✅ Marcar notificação como lida
10. ✅ Console sem erros 401

## Notas de Segurança

⚠️ **ATENÇÃO:** Ao reativar, certifique-se de que:
- Todas as Edge Functions validam JWT corretamente
- RLS policies estão configuradas para proteger dados sensíveis
- Nenhum usuário pode acessar dados de outros usuários sem permissão
- Logs não expõem informações sensíveis

## Histórico
- **2025-11-12**: Sistema desativado devido a erros 401 persistentes
- **Data futura**: Sistema reativado (preencher quando ocorrer)
