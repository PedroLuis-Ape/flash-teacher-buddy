# Auditoria dos pontos de entrada de importação de flashcards

Data da auditoria: 2026-07-28

## Classificação

- **A — Flashcards:** deve compartilhar catálogo, plano, validação e execução.
- **B — Glossário:** permanece separado.
- **C — Administrativo:** permanece separado.
- **D — Legado ou duplicado:** requer migração isolada antes de remoção.

| Ponto de entrada | Componente ou tela | Formato aceito | Destino atual | Motor atual | Cria pasta | Cria lista | Atualiza lista | Aluno | Professor | Classe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Super Importador pessoal | `SuperGlobalImportScreenV2` e variantes | JSON, CSV e texto normalizado | Pasta/lista por plano | RPC transacional pessoal | Sim | Sim | Sim | Sim | Sim | A |
| Super Importador da turma | Mesmas telas em `/turmas/:turmaId/import/super` | JSON, CSV e texto normalizado | Destinos da turma | RPC transacional da turma | Sim | Sim | Sim | Conforme permissão | Sim | A |
| Importação dentro da lista | `BulkImportDialog` → `ContentIngestDialog` | Texto simples e JSON completo | Pasta e lista travadas | Mesmo RPC transacional | Não | Não | Sim | Sim | Sim | A |
| Importador simples global | `GlobalImport` em `/import` | Texto e bloco `[CAMADAS]` | Lista escolhida | Inserções do navegador | Não | Não | Sim | Sim | Sim | D |
| Coleção legada | `Collection` → `BulkImportDialog` | Texto e JSON | Identidade recebida como lista | Adaptador de lista | Não | Não | Sim | Sim | Sim | D |
| Glossário em massa | `BulkGlossaryImportPanel` | Texto/arquivo de glossário | Glossário | Serviço próprio | Não | Não | Não | Sim | Sim | B |
| Glossário por IA | `GlossaryAiExportPanel` | JSON de glossário | Glossário | Serviço próprio | Não | Não | Não | Sim | Sim | B |
| Glossário da conta | `AccountGlossaryImportPanel` | JSON de glossário | Conta | Serviço próprio | Não | Não | Não | Sim | Sim | B |
| Explicações especiais | `special-import` | Protocolo especial | Card/camada exatos | Serviço próprio | Não | Não | Sim | Sim | Sim | B |
| Importação do Reino | `KingdomImport` | Pacote de atividade | Reino | Serviço próprio | Não | Não | Não | Sim | Sim | C |

## Decisão do BO atual

O núcleo existente foi preservado:

1. `GlobalImportDestinationPlan` é a fonte de verdade do destino.
2. `validateDestinationPlan()` valida IDs, pertencimento e ações.
3. `executeMappedGlobalImport()` continua sendo o único executor dos fluxos seguros.
4. O catálogo pessoal recebe `institutionId`; o catálogo de turma recebe `turmaId`.
5. A importação direta em lista deriva instituição e turma da pasta travada.
6. Glossários e ferramentas administrativas não foram acoplados ao seletor de flashcards.

## Pendências separadas

- Migrar `/import` para um adaptador do executor transacional antes de remover seus inserts diretos.
- Auditar a identidade de `/collection/:id` antes de alterar ou remover o fluxo.
- Adicionar lançadores contextuais na Biblioteca e na pasta em PRs próprios.
- Avaliar reforço server-side de escopo institucional em migration aditiva separada; nenhuma migration integra este BO.
