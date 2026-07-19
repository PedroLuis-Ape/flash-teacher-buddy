# Contrato de ambiente do App Piteco

## Backend de dados em producao

O frontend publicado do App Piteco deve usar o projeto que contem as contas e os dados existentes:

`ymahldldyxvwjeruaxpr`

URL: `https://ymahldldyxvwjeruaxpr.supabase.co`

Esse e o backend de producao para autenticacao, perfis, pastas, listas, flashcards e glossarios existentes.

## Projeto gerenciado para operacoes administrativas

O projeto `xrnfhhoxmmstagmelvyi` permanece reservado para operacoes administrativas, migrations e diagnosticos especificos. Ele nao deve substituir o backend de dados do navegador sem migracao completa, validacao de ownership, comparacao de contagens e aprovacao explicita.

## Regra obrigatoria do frontend

- `src/integrations/supabase/platformRuntime.ts` e a fonte unica de configuracao do cliente do navegador.
- Em producao, URL, project ref e chave publica devem formar um conjunto atomico do projeto `ymahldldyxvwjeruaxpr`.
- Valores `VITE_SUPABASE_*` de outro projeto nao podem trocar silenciosamente o backend de producao.
- Todos os clientes do navegador, incluindo sincronizacao de convidado, devem usar `readPlatformRuntime()`.
- O preflight dos importadores deve exibir o project ref efetivamente conectado antes de aceitar analise ou gravacao.

## Seguranca

A URL e a chave publica sao configuracoes enviadas ao navegador. A seguranca depende de RLS, RPCs, Edge Functions e autorizacao no servidor.

Nunca colocar no frontend:

- service role;
- senha de banco;
- tokens administrativos;
- segredos de Edge Functions.

## Troca futura de backend

Uma troca do backend de producao so pode ocorrer apos inventario de contas e registros, migracao integral, validacao de autenticacao e ownership, comparacao de contagens, testes de leitura e escrita, plano de rollback e aprovacao explicita do proprietario do App Piteco.

Nenhuma migration desta correcao altera ou remove dados do projeto `ymahldldyxvwjeruaxpr`.
