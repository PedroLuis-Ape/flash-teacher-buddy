# Runtime e dados do App Piteco

Atualizado: 2026-07-13

O App Piteco usa um único projeto Supabase para runtime, autenticação, dados, migrations e funções públicas:

`xrnfhhoxmmstagmelvyi`

A separação anteriormente documentada entre um projeto administrado e outro backend de dados estava incorreta. Ela foi removida do frontend, dos scripts de pré-renderização, das Edge Functions da Netlify, do MCP e dos contratos de CI.

## Regra atual

- todo cliente deve validar `xrnfhhoxmmstagmelvyi`;
- outro hostname Supabase deve ser rejeitado;
- nenhuma chave pública de projeto alternativo fica embutida no bundle;
- o navegador recebe a configuração pública pelas variáveis oficiais ou por `app-public-config`;
- credenciais de servidor permanecem fora do frontend.

## Estado do schema

O projeto oficial contém o núcleo de estudo, importação, glossários e loja. Em 2026-07-13 foram adicionadas de forma idempotente as estruturas de perfil público, páginas canônicas, ciclo HTTP público e Core Web Vitals. A camada completa de turmas continua sendo uma reconstrução separada, porque essas tabelas não faziam parte do rebuild atual do banco.
