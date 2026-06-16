# Etapa 5 — Sincronização anônima opcional

## Objetivo

Manter uma cópia opcional do histórico público no Supabase sem usar IP, fingerprint ou o login principal do aplicativo.

## Arquitetura

- O visitante continua usando o histórico local da Etapa 4.
- Ao ativar o backup, um segundo cliente Supabase cria uma sessão anônima isolada.
- Essa sessão grava somente a própria linha em `anonymous_portal_history`.
- As políticas RLS exigem `owner_id = auth.uid()` e o claim `is_anonymous = true`.
- Usuários permanentes usam a tabela separada `user_portal_history`.
- Quando a conta principal entra, o navegador lê a linha anônima pelo cliente isolado, mescla os dados e grava a linha da conta pelo cliente principal.
- A linha anônima é removida após a migração.

## Requisitos para publicação

1. Aplicar a migration `20260616214500_portal_history_server_sync.sql`.
2. Ativar **Anonymous Sign-Ins** no painel do Supabase Auth.
3. Manter as políticas RLS da migration.
4. Não reutilizar o storage key `ape-guest-history-sync-auth` no cliente principal.

## Privacidade

- Recurso desligado por padrão.
- Nenhum IP é salvo pelo aplicativo.
- Nenhum nome ou e-mail é salvo na tabela anônima.
- O histórico contém no máximo 12 registros.
- Cada payload é limitado a 32 KB.
- Linhas anônimas ficam inacessíveis após 90 dias sem renovação.
- O visitante pode apagar a cópia do servidor pela interface.

## Limite conhecido

A sessão anônima fica ligada ao armazenamento de autenticação deste navegador. Ela não funciona como código de pareamento entre dispositivos. A sincronização entre dispositivos acontece depois que o histórico é migrado para uma conta permanente.

## Limpeza administrativa recomendada

O Supabase não remove automaticamente usuários anônimos antigos. O administrador pode programar uma rotina periódica para excluir usuários anônimos antigos do schema `auth`, conforme a política de retenção do projeto. As linhas de histórico são removidas automaticamente pelo `ON DELETE CASCADE` quando o usuário anônimo é excluído.
