# Contrato de ambiente do App Piteco

## Projeto Supabase canônico

O frontend, preview, Edge Functions e migrations do App Piteco usam o projeto:

`xrnfhhoxmmstagmelvyi`

URL: `https://xrnfhhoxmmstagmelvyi.supabase.co`

Esse projeto é a fonte canônica para autenticação, perfis, pastas, listas, flashcards, glossários e importações transacionais.

## Regra obrigatória do frontend

- `src/integrations/supabase/platformRuntime.ts` é a única fonte de configuração do cliente do navegador.
- URL, project ref e chave pública devem formar um conjunto atômico do projeto `xrnfhhoxmmstagmelvyi`.
- Valores `VITE_SUPABASE_*` de um projeto legado são rejeitados e não podem trocar o backend do aplicativo.
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

O projeto legado `ymahldldyxvwjeruaxpr` não recebe alterações nesta implementação.
