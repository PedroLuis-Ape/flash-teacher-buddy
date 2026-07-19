# Contrato de ambiente do App Piteco

## Backend de dados canônico

O frontend, preview, Edge Functions e migrations do App Piteco usam o projeto:

`ymahldldyxvwjeruaxpr`

URL: `https://ymahldldyxvwjeruaxpr.supabase.co`

Esse projeto é a fonte canônica para autenticação, perfis, pastas, listas, flashcards, glossários e importações transacionais.

O projeto `xrnfhhoxmmstagmelvyi` continua sendo o projeto administrado pelas ferramentas durante a transição, mas não deve receber o runtime do frontend enquanto os dados reais permanecerem em `ymahldldyxvwjeruaxpr`.

## Regra obrigatória do frontend

- `src/integrations/supabase/platformRuntime.ts` é a única fonte de configuração do cliente do navegador.
- URL, project ref e chave pública devem formar um conjunto atômico do projeto `ymahldldyxvwjeruaxpr`.
- Valores `VITE_SUPABASE_*` de outro projeto são rejeitados e não podem trocar o backend do aplicativo.
- Todos os clientes do navegador, incluindo sincronização de convidado, devem usar `readPlatformRuntime()`.
- O preflight dos importadores deve exibir o project ref efetivamente conectado antes de aceitar análise ou gravação.

## Segurança

A URL e a chave pública são configurações enviadas ao navegador. A segurança continua dependendo de RLS, RPCs, Edge Functions e autorização no servidor.

Nunca colocar no frontend:

- service role;
- senha de banco;
- tokens administrativos;
- segredos de Edge Functions.

## Troca futura de backend

Uma troca do projeto canônico só pode ocorrer após inventário de dados, validação de autenticação e ownership, comparação de contagens, testes de leitura e escrita, plano de rollback e aprovação explícita do proprietário do App Piteco.

Uma migração futura para `xrnfhhoxmmstagmelvyi` só pode ocorrer depois que os dados, usuários e permissões forem migrados e validados.
