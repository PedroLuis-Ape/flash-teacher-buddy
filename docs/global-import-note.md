# Super Importador Global — protocolo canônico

## Arquitetura

O módulo continua apoiado no importador existente. O formato público novo é validado e normalizado antes de reutilizar os modos de destino, a prévia e a transação já consolidada.

Fluxo:

1. `schema/globalImportSchema.ts` define o contrato `ape-global-import` V1.
2. `canonicalPrompt.ts` gera o modelo, o `request_id` e o manifesto.
3. `manifest.ts` grava localmente a configuração, o hash e o status.
4. `analysisService.ts` combina parser, manifesto e validação.
5. `normalizer.ts` converte o formato canônico para o modelo interno sem remover o suporte legado.
6. `destinationModes.ts` continua responsável pelos três modos de destino e políticas de conflito.
7. `mappedService.ts` envia pacotes canônicos para `import_global_package_v2` e pacotes legados para `import_global_package_v1`.
8. A RPC V2 valida o protocolo novamente no servidor, converte para o transporte interno e delega a persistência à RPC V1 dentro da mesma transação.

## Fonte única

O schema canônico está em:

`src/features/global-import/schema/globalImportSchema.ts`

O exemplo oficial, os tipos, os limites, o parser canônico, o gerador de prompt e os testes dependem desse arquivo. O formato legado permanece apenas como camada de compatibilidade.

## Limites iniciais

- arquivo: 5 MB;
- pastas: 100;
- listas: 500;
- cards: 5.000;
- somente card `type: "normal"`;
- termos e traduções: 8.000 caracteres;
- explicações e campos longos: 16.000 caracteres.

## Feature flag

A RPC canônica possui um kill switch no cliente:

```env
VITE_GLOBAL_IMPORT_V2_ENABLED=false
```

Com o valor `false`, o Super Importador continua disponível, mas usa a RPC V1 com o pacote já normalizado. O padrão é habilitado para preservar o comportamento implementado nas PRs anteriores.

## Migrations

- `20260618190000_import_global_package_v2.sql`: validação canônica, adaptação transacional, configurações de estudo e campos ricos;
- `20260618190100_global_import_v2_permissions.sql`: permissão restrita necessária para o validador recursivo chamado pela RPC V2.

## Rollback operacional

Rollback imediato sem remover banco:

1. definir `VITE_GLOBAL_IMPORT_V2_ENABLED=false`;
2. publicar novamente o frontend;
3. a tela volta a chamar `import_global_package_v1`.

Rollback de banco, somente após confirmar que nenhuma versão publicada chama a V2:

```sql
REVOKE EXECUTE ON FUNCTION public.import_global_package_v2(uuid, jsonb, jsonb, text, uuid) FROM authenticated;
DROP FUNCTION IF EXISTS public.import_global_package_v2(uuid, jsonb, jsonb, text, uuid);
DROP FUNCTION IF EXISTS public.global_import_json_has_forbidden_key(jsonb);
```

Não remover as tabelas de controle nem a RPC V1: elas pertencem ao importador global já existente e também sustentam o desfazer.

## Verificação

O workflow `.github/workflows/global-import-check.yml` executa:

```bash
npm ci
npm run check
```

O script `check` roda typecheck, testes, lint e build. A PR não deve sair de rascunho enquanto qualquer etapa estiver falhando.
