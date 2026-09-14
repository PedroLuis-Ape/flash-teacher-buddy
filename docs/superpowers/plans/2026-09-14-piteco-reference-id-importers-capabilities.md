# App Piteco — Reference IDs, Importadores Oficiais e Capability Map

> Plano de implementação executado em worktree isolado. O código continua tendo o GitHub/main como fonte canônica; nenhuma migration é aplicada em produção e nenhum deploy/publicação é feito automaticamente.

## Objetivo

Expor no MCP as capacidades reais de conteúdo do Piteco e seus importadores oficiais, sem criar um segundo sistema de importação, e adicionar identificadores humanos estáveis para pastas e listas. O agente deve conseguir descobrir capacidades, escolher o caminho de criação em massa e preservar campos contextuais, glossários e camadas conforme os contratos já existentes.

## Contexto consolidado do mapeamento

- Flashcards reais possuem campos básicos e enriquecidos (`term`, `translation`, `hint`, exemplos, contexto, explicação, notas, idioma, áudio/imagem e metadados de camadas); `status_group_uid` é derivado e não é entrada externa.
- Camadas usam `parent_card_id` e `layer_index` zero-based; a criação integral possui RPC atômica oficial.
- Smart Import 2.0 e Super Import convergem para os parsers/validações existentes; o executor pessoal oficial é `import_app_piteco_super_package_current` e há undo por batch.
- Glossário de pasta usa `import_folder_glossary_v2`, com merge/replace e dry-run; fluxos legados sem undo/hierarquia não entram como caminho normal do MCP.
- O domínio MCP valida OAuth e ownership por helpers; instituição no MCP fica owner-only nesta entrega. Classroom/administrativo/Reino/vídeo ficam fora.

## Contratos e invariantes

1. UUID continua sendo a identidade canônica. `reference_id` é apenas alias humano, nunca autorização.
2. Pastas recebem `F-XXXXXX` e listas `L-XXXXXX`, com alfabeto legível, unicidade global por tabela, geração automática, backfill idempotente e imutabilidade.
3. Resolução por referência ocorre depois do filtro de identidade/escopo; nomes continuam aceitos somente quando únicos. Ambiguidade retorna candidatos e não escolhe silenciosamente.
4. Todo write usa identidade OAuth; não aceita `user_id` arbitrário e não usa service role.
5. Bulk usa os importadores oficiais; alterações pequenas permanecem nas tools granulares; camada integral usa o RPC atômico quando aplicável.
6. Preview não promete transação que o executor não oferece. Se o dry-run for somente local, o retorno explicita essa limitação.
7. Replace/overwrite exige confirmação explícita. Retry usa `request_id` estável e não deve duplicar o lote.
8. `supabase/functions/mcp/index.ts` é bundle gerado; nunca editar manualmente. A migration será entregue para revisão/aplicação separada.

## Execução por lotes

### Lote A — Identidade e resolução

- Criar migration para colunas, função/trigger de geração, backfill, unicidade e imutabilidade.
- Atualizar tipos Supabase e helpers de acesso para resolver UUID ou referência com o escopo já validado.
- Incluir `uuid` e `reference_id` nos retornos de pastas/listas e uma affordance compacta de copiar na UI.
- Testar primeiro os contratos em RED e depois a implementação.

### Lote B — Capability map

- Criar tool read-only `get_piteco_capabilities` com um contrato compacto e fiel ao produto.
- Consultar `get_import_capabilities_v1` no contexto autenticado; reportar indisponibilidade sem inventar suporte.
- Registrar a tool no catálogo/manifesto e cobrir forma, segurança e annotations.

### Lote C — Importadores MCP

- Criar preview/execute de conteúdo estruturado, como wrappers finos do parser/validação e executor Super Import oficial.
- Criar preview/execute de glossário de pasta, chamando o RPC oficial v2 com dry-run quando solicitado.
- Converter seletores de destino por UUID/referência/nome através dos helpers de acesso; manter escopo pessoal e não expor classroom.
- Cobrir campos enriquecidos, camadas, limites, replace, erro parcial e idempotência por request id.

### Lote D — Consolidação

- Atualizar catálogo MCP e Segundo Cérebro com decisões duráveis, limitações, validações e próximo passo operacional.
- Rodar typecheck, testes direcionados, lint, build, checks de MCP/manifesto e `brain:check` quando disponível.
- Revisão cruzada independente antes de considerar o lote DONE. A migration e eventual bundle gerado ficam pendentes de aplicação/deploy explícito.

## Critérios de conclusão

- [ ] Migration revisável, idempotente no backfill e com invariantes de unicidade/imutabilidade.
- [ ] Referências aparecem nos retornos MCP/UI sem substituir UUID nem relaxar ownership/RLS.
- [ ] Capability map lista somente capacidades comprovadas e orienta o caminho bulk/granular.
- [ ] Importadores oficiais são reutilizados, com preview honesto, destino seguro e sem inserts paralelos.
- [ ] Testes e gates executados com evidência; nenhum CRITICAL/HIGH aberto.
- [ ] Segundo Cérebro atualizado e conectado a `[[mcp-agent-api]]`, `[[card-identity]]`, `[[importers]]` e `[[glossary]]`.
- [ ] Nenhum deploy, publicação ou aplicação de migration em produção realizada automaticamente.
