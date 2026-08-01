# Preview Safety e Rollback

Este documento descreve o gate permanente para evitar que uma alteração deixe o preview vazio, travado ou sem diagnóstico. Ele protege o frontend e não faz alterações no Supabase.

## O que o gate verifica

- `/__preview-health` renderiza sem inicializar Supabase ou autenticação.
- Configuração pública incompleta ou incompatível mostra uma tela técnica recuperável.
- Falhas do carregamento do componente global mostram um identificador técnico, recarga e retorno ao início.
- Rotas públicas, autenticação, 404, indisponibilidade do endpoint Supabase e viewport móvel continuam visíveis.
- O build, typecheck, testes e lint são executados antes do smoke browser.

## Execução local

```text
npm ci
npx playwright install chromium
npm run typecheck
npm run test
npm run lint
npm run build
npm run preview:smoke
```

O smoke cria um build dedicado no modo `preview-smoke`, inicia um servidor local e encerra o processo ao terminar. Screenshots de uma falha ficam em `artifacts/preview-smoke/`, que não é versionado.

## Publicação pela Lovable

A publicação do frontend continua sendo feita exclusivamente pela Lovable. O merge só deve ocorrer depois de o workflow `Preview Safety Gate` estar verde. Depois da publicação, confirme `/__preview-health` no preview da Lovable antes de publicar para usuários.

O route health não consulta Supabase, não lê sessão e não exibe chaves. Ele confirma somente que o bundle consegue montar uma superfície mínima.

## Rollback seguro

1. Pare a publicação e registre a URL, rota, versão, build, commit e identificador técnico exibidos.
2. Localize o último commit de `main` com o gate verde.
3. Faça um PR de reversão usando `git revert <merge-commit>`; não use `reset --hard` nem reescreva `main`.
4. Execute novamente o gate antes de pedir a publicação pela Lovable.
5. Não faça rollback destrutivo de schema, não troque project ref e não execute migration remota como parte desse procedimento.

Se o problema for somente de ambiente, corrija o ambiente de preview e repita a validação. A aplicação deve continuar mostrando a falha de configuração em vez de inventar dados ou remover campos para seguir adiante.

## Limites

Este gate não confirma que um banco remoto está íntegro nem substitui os testes de segurança ou migrations do Supabase. Qualquer mudança de contas, dados, Auth, RLS, RPC ou migration precisa de tarefa separada, evidência específica e rollback revisável.
