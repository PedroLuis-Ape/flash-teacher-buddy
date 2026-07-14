# Contrato de ambiente do App Piteco

Atualizado: 2026-07-13

## Projeto único e oficial

Autenticação, perfis, pastas, listas, flashcards, glossários, loja, páginas públicas e telemetria usam o mesmo projeto Supabase:

`xrnfhhoxmmstagmelvyi`

URL canônica da API:

`https://xrnfhhoxmmstagmelvyi.supabase.co`

Não existe separação entre “projeto administrado” e “backend de dados”. Configurações que apontem para outro project ref devem ser rejeitadas.

## Inicialização do navegador

- `src/integrations/supabase/platformRuntime.ts` valida o project ref e a URL oficial.
- `src/integrations/supabase/runtimeBootstrap.ts` aceita um conjunto completo de variáveis públicas oficiais ou consulta `app-public-config` no próprio projeto.
- `src/main.tsx` instala o runtime antes de importar `App.tsx` e antes de criar qualquer cliente Supabase.
- `src/integrations/supabase/client.ts` usa exclusivamente `readPlatformRuntime()`.
- Builds, Edge Functions da Netlify e MCP aplicam a mesma validação de projeto.

## Variáveis públicas opcionais

As três variáveis devem ser fornecidas juntas quando a plataforma optar por injetá-las:

- `VITE_SUPABASE_PROJECT_ID=xrnfhhoxmmstagmelvyi`
- `VITE_SUPABASE_URL=https://xrnfhhoxmmstagmelvyi.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY=<chave pública ativa>`

Quando não forem injetadas, o bootstrap consulta:

`/functions/v1/app-public-config`

## Segurança

A URL e a chave publicável são configurações públicas do navegador. A segurança depende de RLS, RPCs validadas, Edge Functions e autorização no servidor.

Nunca colocar no frontend:

- service role;
- senha do banco;
- token administrativo;
- segredo de Edge Function;
- chave privada de integração.

Credenciais de servidor, como a usada por `/api/rum`, devem existir somente no escopo Functions da Netlify.

## Regra de mudança

Uma futura troca de projeto exige inventário, migração, comparação de contagens, validação de autenticação e ownership, testes de escrita/leitura, rollback e aprovação explícita. Até isso acontecer, qualquer project ref diferente de `xrnfhhoxmmstagmelvyi` é inválido.
