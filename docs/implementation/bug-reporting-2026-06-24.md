# Sistema de reporte de erros — 2026-06-24

## Objetivo

Criar um canal básico, seguro e mobile-first para usuários autenticados reportarem problemas no App Piteco, sem botão flutuante, sem pop-up invasivo e sem cobrir a navegação inferior.

## Decisão de UX

O ponto de acesso foi adicionado ao menu lateral privado (`AppSidebar`), na seção **Ferramentas**, como **Reportar problema**.

Motivo:

- já existe no chrome autenticado do app;
- não compete com a tab bar inferior mobile;
- não cria elemento flutuante sobre conteúdo;
- mantém o fluxo previsível para professor e aluno.

## Frontend

Arquivos principais:

- `src/pages/BugReport.tsx`
- `src/App.tsx`
- `src/components/layout/AppSidebar.tsx`

Funcionalidades:

- rota privada visual `/reportar-problema`;
- formulário com tipo, urgência, título e descrição;
- validação mínima no frontend;
- estados de envio, sucesso e erro;
- toast de confirmação/falha;
- envio de metadados úteis: rota atual, user agent, idioma e viewport;
- layout com `ApeAppBar`, `Card`, `Alert`, `Input`, `Textarea`, `Select` e `Button`, reutilizando padrões existentes.

## Banco de dados

Migração:

- `supabase/migrations/20260624070000_create_bug_reports.sql`

Tabela criada:

- `public.bug_reports`

Campos principais:

- `user_id`
- `category`
- `severity`
- `title`
- `description`
- `page_url`
- `user_agent`
- `status`
- `metadata`
- `created_at`
- `updated_at`

## Segurança / RLS

RLS habilitado na tabela `bug_reports`.

Policies:

- usuário autenticado pode inserir apenas reporte próprio;
- usuário autenticado pode ler apenas reporte próprio;
- usuário autenticado pode atualizar apenas reporte próprio ainda `open`.

A tela não expõe leitura administrativa. O resumo administrativo fica preparado via view `bug_reports_admin_summary`, mas respeitando RLS/security invoker.

## Validação mobile-first

A tela usa largura máxima `max-w-2xl`, padding inferior `pb-32` e botões empilhados no mobile. O acesso fica dentro do menu lateral, portanto não cobre tab bar, cards ou área de estudo.

## Limites conhecidos

- Ainda não há painel administrativo de triagem dos reportes.
- Ainda não há upload de imagem/anexo.
- O frontend usa `supabase as any` para inserir em `bug_reports` porque `src/integrations/supabase/types.ts` é gerado e ainda não foi regenerado nesta implementação.
