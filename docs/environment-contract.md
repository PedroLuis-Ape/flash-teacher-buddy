# Contrato de ambiente do App Piteco

## Produção com dados reais

O frontend publicado do App Piteco deve usar o projeto Lovable Cloud que contém as contas e os dados existentes:

`ymahldldyxvwjeruaxpr`

Esse é o backend de produção do navegador para autenticação, perfis, pastas, listas, flashcards e glossários já existentes.

## Projeto Supabase conectado às ferramentas administrativas

O projeto abaixo permanece conectado para operações administrativas, migrations e auditorias específicas:

`xrnfhhoxmmstagmelvyi`

Ele não deve substituir automaticamente o backend do frontend enquanto não existir uma migração de dados completa, validada e explicitamente aprovada. Apontar o aplicativo publicado para esse projeto faz contas e flashcards existentes parecerem ausentes.

## Regra obrigatória do frontend

- `src/integrations/supabase/platformRuntime.ts` é a única fonte de configuração do cliente do navegador.
- Em produção, URL, project ref e chave pública devem formar um conjunto atômico do projeto `ymahldldyxvwjeruaxpr`.
- Valores `VITE_SUPABASE_*` injetados por uma integração antiga não podem trocar o backend de produção.
- Overrides para outro projeto são permitidos somente em desenvolvimento local explícito.
- Todos os clientes do navegador, incluindo sincronização de convidado, devem usar `readPlatformRuntime()`.

## Segurança

A URL e a chave anon são configurações públicas enviadas ao navegador. A segurança continua dependendo de RLS, RPCs, Edge Functions e autorização no servidor.

Nunca colocar no frontend:

- service role;
- senha de banco;
- tokens administrativos;
- segredos de Edge Functions.

## Mudança futura de backend

Uma troca do projeto de produção só pode ocorrer após:

1. inventário das contas e registros;
2. migração integral dos dados;
3. validação de autenticação e ownership;
4. comparação de contagens;
5. testes de leitura e escrita;
6. plano de rollback;
7. aprovação explícita do proprietário do App Piteco.

Até essa migração existir, o frontend de produção permanece bloqueado em `ymahldldyxvwjeruaxpr`.
