# Orientacao — banco correto do App Piteco

## Resposta curta

Todos os usuarios, perfis, pastas, listas, flashcards, glossarios, favoritos e progresso existentes ficam no **backend de dados em producao** do App Piteco.

O projeto administrado pelo repositorio/ferramentas existe para operacoes tecnicas durante a transicao, mas **nao e o banco que o app deve usar no navegador**.

## Regra de ouro

Se depois de uma alteracao grande o app abrir vazio, sem usuarios, sem flashcards ou com erro de chave, trate primeiro como **runtime conectado no backend errado**.

Antes de mexer em tela, importador ou estudo, confira o contrato de ambiente.

## Fonte de verdade no codigo

A fonte unica para o cliente do navegador e:

```txt
src/integrations/supabase/platformRuntime.ts
```

Regras obrigatorias:

- `PRODUCTION_DATA_PROJECT_ID` representa o backend com os dados reais.
- `MANAGED_SUPABASE_PROJECT_ID` representa o projeto administrado por ferramentas/transicao.
- O app publicado e o preview devem ler o runtime por `readPlatformRuntime()`.
- Nenhum cliente do navegador deve criar conexao propria usando outro `project_id`, URL ou chave publica.

## O que nunca fazer para "corrigir" dados sumidos

- Nao trocar o runtime do frontend para o projeto administrado.
- Nao editar `src/integrations/supabase/client.ts`; ele deve continuar usando `readPlatformRuntime()`.
- Nao substituir `VITE_SUPABASE_*` parcialmente: project id, URL e chave publica precisam ser um conjunto atomico.
- Nao colar service role, senha de banco, token administrativo ou segredo em arquivo de frontend.
- Nao assumir que listas/flashcards foram apagados antes de confirmar o backend efetivamente conectado.

## Checklist quando parecer que "perdeu tudo"

1. Rodar a validacao de plataforma:

```bash
node scripts/check-platform.mjs
```

2. Confirmar que o app continua usando `readPlatformRuntime()`.
3. Confirmar que `PRODUCTION_DATA_PROJECT_ID` nao foi trocado.
4. Conferir se a chave publica pertence ao mesmo backend de producao.
5. So depois investigar RLS, queries, cache ou telas.

## Diagnostico rapido

| Sintoma | Causa mais provavel |
| --- | --- |
| Login mostra `Invalid API Key` | Chave publica nao corresponde ao backend conectado |
| App abre vazio depois de update grande | Frontend caiu no projeto administrado/transicao |
| Usuarios existem em um ambiente, mas nao no preview | Preview usando runtime diferente do backend de producao |
| Importadores/preflight mostram outro ref | Configuracao externa tentou substituir o runtime correto |

## Documento relacionado

Leia tambem:

- `docs/environment-contract.md`
- `docs/runtime-data-split.md`