# Contrato de ambiente do App Piteco

## Fonte oficial

O único backend autorizado do App Piteco é o projeto Supabase:

`xrnfhhoxmmstagmelvyi`

Repositório oficial: `PedroLuis-Ape/flash-teacher-buddy`.

Toda configuração de frontend, migration, Edge Function, RLS, Storage, documentação e automação deve apontar para esse project ref. Nenhum outro projeto pode ser usado como fallback, produção alternativa ou destino implícito.

## Configuração pública do frontend

A configuração pública necessária para inicializar o navegador é entregue pela Edge Function `app-public-config` do próprio projeto oficial.

Fluxo:

1. `src/main.tsx` consulta `https://xrnfhhoxmmstagmelvyi.supabase.co/functions/v1/app-public-config`;
2. a resposta informa somente os valores públicos necessários para criar o cliente;
3. o bootstrap valida o project ref e o hostname;
4. somente depois dessa validação o módulo principal do aplicativo é carregado;
5. qualquer divergência interrompe a inicialização e exibe um erro seguro.

Variáveis `VITE_SUPABASE_*` continuam aceitas para desenvolvimento ou deploy controlado, mas precisam formar um conjunto completo e corresponder ao projeto oficial.

## Política de arquivos de ambiente

- `.env` e `.env.*` não podem ser versionados;
- `.env.example` é o único modelo permitido;
- chaves administrativas, service role, senhas, tokens e segredos nunca podem entrar no frontend;
- a chave pública do navegador não é autorização: RLS, RPCs e Edge Functions continuam responsáveis pela segurança.

## Invariantes verificadas pelo CI

`npm run check:environment` bloqueia publicação quando:

- `supabase/config.toml` não declara um project ref válido;
- o endpoint público de runtime aponta para outro projeto;
- o formato da URL da Edge Function não é o formato canônico `/functions/v1/...`;
- `src/main.tsx` ou o cliente Supabase divergem do project ref oficial;
- `app-public-config` não está registrada como função pública;
- uma configuração `VITE_SUPABASE_*` parcial ou incompatível é fornecida;
- arquivos de ambiente versionados contêm variáveis privadas ou não públicas.

## Backend desbloqueado

A conexão administrativa disponível possui acesso ao projeto oficial. Alterações de backend podem ser executadas nele desde que:

- sejam versionadas como migrations ou Edge Functions;
- tenham rollback ou procedimento de correção;
- passem pelas auditorias de segurança e desempenho;
- não apaguem dados sem inventário e proteção apropriada;
- sejam testadas antes da integração em `main`.
