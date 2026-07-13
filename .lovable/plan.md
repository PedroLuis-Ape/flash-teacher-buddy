## Diagnóstico corrigido

O App Piteco usa um único projeto Supabase ativo e oficial:

`xrnfhhoxmmstagmelvyi`

A separação anteriormente implementada entre um projeto gerenciado e outro backend de dados estava incorreta. O runtime antigo rejeitava o projeto oficial e forçava o navegador, os scripts de pré-renderização, as Edge Functions da Netlify e o MCP a apontarem para outro project ref.

## Correção implementada

1. `platformRuntime.ts` valida somente `xrnfhhoxmmstagmelvyi`.
2. `runtimeBootstrap.ts` aceita variáveis oficiais completas ou consulta `app-public-config` no projeto oficial.
3. `main.tsx` instala o runtime antes de importar `App.tsx` e antes da criação do cliente Supabase.
4. `AuthContext.tsx` lê a sessão persistida usando a URL oficial quando as variáveis Vite não estão presentes.
5. Edge Functions, scripts de sitemap/pré-render e MCP usam o mesmo projeto.
6. CI rejeita referências ativas ao antigo project ref.
7. Migrations de compatibilidade restauram de forma aditiva os campos de perfil, publicação pública, páginas canônicas, ciclo `404/410` e Core Web Vitals no projeto oficial.

## Regra operacional

Não adicionar novamente constantes de “managed project” e “production data project”. Não embutir chave pública alternativa no bundle. Toda configuração deve formar um conjunto atômico do projeto `xrnfhhoxmmstagmelvyi`.

A camada completa de turmas deve ser reconstruída separadamente, porque essas tabelas não faziam parte do rebuild atual do banco oficial.
