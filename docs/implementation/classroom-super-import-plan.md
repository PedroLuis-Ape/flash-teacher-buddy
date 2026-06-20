# Super Importador dentro das turmas

Implementação baseada no mesmo motor `app-piteco-super-import 2.0`.

## Escopo

- Rota contextual `/turmas/:turmaId/import/super`.
- Catálogo de destino limitado às pastas/listas da turma.
- Importação transacional com `turma_id` obrigatório no contexto de turma.
- Novas pastas recebem `class_id`, `visibility=class` e atribuição automática.
- Pastas existentes precisam pertencer à turma e ao professor.
- Lotes registram `target_scope=classroom` e `turma_id`.
- Desfazer remove primeiro as atribuições criadas, depois cards, glossário, listas e pastas.
- O importador pessoal continua usando o mesmo RPC com `turma_id=null`.
