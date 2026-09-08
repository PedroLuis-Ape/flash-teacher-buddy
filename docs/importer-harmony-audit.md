# Harmonização dos importadores — auditoria e progresso, 2026-09-08

Base: `14af3d597bbed494b735a6726f789794b4805f9f`. Inventário registrado antes de modificar código funcional. Esta é uma auditoria estática em andamento, não uma declaração de validação em produção.

## Entradas identificadas

| Entrada / arquivo | Tela / consumidor | Entrada, parser e validação | Persistência | UX atual e riscos a verificar |
| --- | --- | --- | --- | --- |
| `global-import/SuperGlobalImportScreenV2.tsx` | `/import`, `/import/super`, importação de turma | JSON oficial 1/2, canonical/legado, CSV e texto; `useGlobalImportSource`, `validation`, `sourceParser`, `csvPackage`; capacidades e destino | `executeMappedGlobalImport`, gateways pessoais/turma | Análise, destino, confirmação, relatório/desfazer. Erros técnicos podem aparecer; leitura concorrente pode substituir uma entrada mais recente. Mobile ainda não executado. |
| `global-import/GuidedGlobalImportScreen.tsx` | Mesmas rotas, flag V3 | Mesmos parsers e contratos | Mesmo executor | Etapas e preview, labels diferentes; fallback afirma desfazer sem confirmação de resultado remoto. Mobile pendente. |
| `global-import/OwnerGuidedImportWizard.tsx` | Mesmas rotas, rollout | Mesmos parsers e contratos | Mesmo executor; cancelamento com compensação do lote | Simulação e confirmação, ações em portal; cancelamento não equivale a abortar a transação. Mobile pendente. |
| `smart-import/ContentIngestDialog.tsx` via `BulkImportDialog.tsx` | `ListDetail` e `Collection` | Texto/CSV colado e JSON completo em arquivo; `sourceParser`, `importFile`, destino travado e capacidades | Mesmo executor com lista/pasta existentes | Três etapas, contagens, duplicados/desfazer. Auditar identidade `collectionId` passada como `listId`; não adivinhar equivalência. Dialog 92vh, footer com várias ações; mobile pendente. |
| `study/components/FolderGlossaryManagerCore.tsx` | Glossário da pasta, `/glossary`, `ClassGlossaryManager` | JSON, `folderGlossaryTransfer`; extensão, limite 25MB e preview | `useFolderGlossary` → `importFolderGlossary` → RPC v2/v1 | Mesclar/substituir, preview, progresso, cancelamento bloqueado durante gravação. Lotes não constituem uma transação global; falha parcial precisa preservar evidência. Mobile pendente. |
| `study/components/AccountGlossaryManager.tsx` via `ListGlossaryManager` | `ListDetail` | JSON/texto, `glossaryTransfer`; contagem e erros | `useListGlossary` | Aceita entradas válidas mesmo com erros sem confirmação explícita de aproveitamento parcial; promise de gravação sem catch local; fechamento permitido enquanto grava. Dialog sem limite vertical. |
| `study/components/FolderGlossaryCoverageCard.tsx` | Auditoria do glossário de pasta | JSON preenchido; `parseExactCoverageCompletionJson` confere relatório; 25MB | Mutation do glossário em merge | Escolher arquivo já grava, sem etapa de confirmação. Toast duplicado com hook; reanálise pode falhar depois da gravação. |
| `classroom/components/ClassGlossaryCoverageCard.tsx` | Auditoria do glossário da turma | Mesmo contrato/parser exato | Mesmo hook, pasta de armazenamento da turma | Mesma gravação automática ao escolher arquivo, duplicação de leitura e feedback. |
| `study/components/FolderGlossarySemanticReview.tsx` | Revisão semântica de pasta e turma | JSON preenchido, parser contextual semântico; 25MB | Callback dos wrappers de pasta/turma | Leitura não grava; preview aprovado/pendente e aplicação separada. Conferir mudanças de contexto durante leitura, falhas parciais e mobile. |
| `special-import/Bridge.jsx`, `BridgeInput.jsx`, `useBridgeState.js` | Fila de especiais (`GemQueue`, alias `ImportExplanationsDialog`) | JSON v3/v2/legado, CSV/TXT de compatibilidade; manifest, hashes, IDs e consulta de cards | `special-import/lib/service.ts`, RPC por lotes | Preview por status, aplica somente seguros e relatório parcial. Fechar limpa `busy` sem parar operação; seleção/edição durante validação permite corrida; falta trava síncrona de submissão. |
| `pages/KingdomImport.tsx` | `/reino/importar` | CSV UTF-8, parsing/validação na Edge Function `kingdoms-import-csv` | Função com upsert de atividades | Sem análise local/preview antes do POST, sem limite de arquivo no cliente, erro genérico e navegação imediata mesmo com falhas parciais. Sem alterações de mecânica do Reino. |
| `components/FolderGlossarySyncDialog.tsx`, `study/components/AllFoldersGlossarySyncPanel.tsx`, `classroom/components/ClassroomLibraryActions.tsx` | Pastas/glossário/turma | Reutilização de cards existentes; `entriesFromCards` | `folderGlossarySyncApi`, RPC de merge por pasta | Fluxo adicional de ingestão sem arquivo; inventariar prévia/cancelamento por pasta antes de harmonizar. Não confundir sincronização de cache com gravação de novos termos. |
| `components/AddVideoDialog.tsx` | Associação de vídeos | URLs e texto; `youtubeParser` | Metadados de vídeo | Entrada externa auxiliar, não parser de flashcards. Auditoria específica ainda pendente; preservar suporte atual. |
| `pages/admin/AdminCatalogForm.tsx` | Administração do catálogo | Arquivos de imagem/catálogo | Supabase Storage `.upload` | Upload encontrado; loja explicitamente excluída de alterações nesta tarefa. Apenas inventário. |

Os caminhos abreviados acima são relativos a `src/`.

## Legado e falsos positivos

- `pages/GlobalImport.tsx` já é reexport do importador transacional; o documento de julho que o descreve como inserts diretos está desatualizado.
- `BulkGlossaryImportPanel` atualmente é um aviso sobre glossário por pasta, não um importador.
- `AccountGlossaryImportPanel` não apresentou consumidor na busca atual; não reativar a antiga caixa global.
- `lib/fileImport.ts` tem conversor CSV/TSV/TXT, mas não apresentou consumidor de produção na busca atual. Não alterar seu parser sem necessidade.
- `ExchangeTab` é economia, não troca/importação de conteúdo; excluído.

## Backend e fronteiras

- Repositório declara produção `ymahldldyxvwjeruaxpr` e administração `xrnfhhoxmmstagmelvyi`. Não trocar referências.
- Metadados do projeto administrativo responderam e listam os gateways atuais, capacidades e RPCs de glossário.
- A mesma consulta somente leitura em produção foi negada por permissão. Existência no administrativo NÃO comprova implantação ou persistência em produção.
- Nenhuma migration, mudança de RLS/Auth ou escrita remota foi executada nesta auditoria.

## Decisão incremental e mapa de impacto

Preservar parsers e executor existentes. Centralizar somente a leitura segura de arquivo, tratamento de operações concorrentes e UI de seleção/preview onde o contrato coincide. Priorizar confirmação antes de gravação e estado pendente verdadeiro. Não converter parsers de glossário, cards e explicações em um único parser.

UI/estado local são afetados; identidade de cards/grupos, study engine, sessões, Auth, temas, SEO e navegação não são. Queries permanecem limitadas ao destino. Offline deve manter rascunho e comunicar falha, sem prometer rollback remoto por erro de rede. Formatos existentes permanecem. Rollback: reverter apenas os commits desta branch, sem operação em dados.

## Complemento da busca por reutilização

- `study/components/FolderGlossarySyncDialog.tsx` é atualmente apenas navegação para `/glossary?folder=...`, não faz ingestão. Corrige o caminho e a classificação provisória na tabela.
- `AllFoldersGlossarySyncPanel` não tem consumidor de produção encontrado; `ClassroomLibraryActions` é consumido por `TurmaDetailWorkspace`. A sincronização desta última grava por pasta, acumula resultados e tem loading; sem uma transação envolvendo todas as pastas. Reutiliza cards existentes, não requer upload. Mobile ainda pendente.
- `AddVideoDialog` aceita watch/shorts/youtu.be, valida cada linha e insere vídeos em lote na pasta. Não apresenta preview dos ignorados; emite toasts por URL inválida e permite fechar durante gravação. Não gera flashcards.
- `ListDetail` também clona listas: inserts separados de lista e cards, sem transação abrangente. A projeção copiada não inclui todos os campos de camadas. É reutilização de conteúdo no escopo do inventário, e requer tratamento específico antes de afirmar preservação integral.
- `admin/AdminCatalog.tsx` chama `store-admin-batch-import`, com contagens e toasts de sucesso/parcial. Inventariado, mas loja está expressamente excluída de alterações.
- `useListGlossary` resolve o destino por lista/turma/pasta. O nome `AccountGlossaryManager` e os textos de caixa global não representam o destino real atual.
- Reino verifica token e papel `developer_admin` antes dos upserts com credencial de serviço. Faz validação de todas as linhas antes de gravar, mas a gravação é sequencial e pode terminar parcialmente.

## Primeira fatia de implementação

Corrigir leitura assíncrona e preview do Super Importador e unificar leitura segura com o importador de lista. Sem modificar gramáticas, migrations ou contratos. Acrescentar testes reais do hook e do leitor, incluindo corrida entre arquivos, edição, cancelamento, falha e reabertura. Esta fatia não conclui a harmonização das demais entradas.

## Evidências pendentes antes de conclusão

- Completar detalhes de reutilização, auxiliares, autorização/RLS e cancelamento.
- Testes de comportamento antes de modificar qualquer parser.
- Matriz por entrada: válido, vazio, inválido, parcial, grande, cancelar, rede, duplo envio, sucesso.
- QA visual em 360/375/390/412/430px; ainda não realizado.
- Typecheck, testes, lint e build após implementação; ainda não realizados nesta branch.
- Persistência em ambiente autorizado com conta de teste; produção permanece não verificada.

## Primeira correção verificada

- Novo `import-shared/readImportFile.ts`: leitura sem alterar conteúdo ou gramática; limites existentes preservados; vazio e falha de leitura explicados sem expor erro interno.
- `smart-import/importFile.ts` reutiliza o leitor e mantém a restrição JSON.
- `global-import/useGlobalImportSource.ts`: revisão de tentativa impede resultados atrasados de substituir arquivo novo, edição, cancelamento ou estado após desmontagem. Uma nova leitura invalida o preview anterior antes de aguardar o arquivo.
- Testes de comportamento da entrada existente executados antes da alteração: 7 aprovados em 2 arquivos.
- Depois da alteração: 19 testes focados aprovados; suíte completa com 239 arquivos e 1503 testes aprovados; `tsc --noEmit` aprovado; lint dos arquivos alterados aprovado.
- Nenhum parser, schema, RPC, dado remoto, study engine ou sessão foi alterado. Build completo aprovado; lint global aprovado com 0 erros e 71 avisos. Build mantém avisos de CSS global e dados de compatibilidade de browsers antigos, fora desta alteração. QA mobile ainda pendente.
- Isto é uma entrega parcial em branch de trabalho. Não fazer merge/publicar como harmonização completa enquanto a matriz acima e os demais fluxos não estiverem concluídos.
