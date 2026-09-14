---
cssclasses:
  - ape-ai-note
type: area
domain: mcp
status: active
priority: high
last_reviewed: 2026-09-14
related:
  - "[[areas/mcp-agent-api]]"
  - "[[imports/2026-09-11/App-Piteco-Brain/areas/card-identity]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[imports/2026-09-11/App-Piteco-Brain/areas/importers]]"
  - "[[imports/2026-09-11/App-Piteco-Brain/areas/glossary]]"
---

# MCP — Reference IDs e importadores oficiais

## Decisões vigentes

- [DECISÃO VIGENTE] UUID continua sendo o identificador canônico. Pastas e
  listas também expõem referências humanas imutáveis (`F-XXXXXX` e
  `L-XXXXXX`) para descoberta e operação por agentes.
- [DECISÃO VIGENTE] A referência é resolvida somente depois dos filtros de
  posse, escopo, `system_kind`, `class_id` e lixeira. Uma referência de outra
  conta responde como `not_found`, sem vazamento de existência.
- [DECISÃO VIGENTE] A migration
  `supabase/migrations/20260914130000_piteco_reference_ids.sql` gera referências
  com alfabeto sem caracteres ambíguos, faz backfill idempotente, garante
  unicidade e impede alteração posterior por trigger. A migration ainda não
  foi aplicada neste ambiente nem em produção.

## Superfície MCP

- [FATO CONFIRMADO] A fonte `src/lib/mcp/` registra 29 tools. As cinco novas
  são `get_piteco_capabilities`, `preview_content_import`,
  `execute_content_import`, `preview_glossary_import` e
  `execute_glossary_import`.
- [FATO CONFIRMADO] `get_piteco_capabilities` é read-only e consulta
  `get_import_capabilities_v2` e, só na ausência dela, `get_import_capabilities_v1`.
  Payload sem o objeto `capabilities` não é aceito como resposta: a leitura
  segue para a próxima RPC e, sem nenhuma, devolve `unknown` — nunca infere
  suporte. O campo `capability_rpc` informa qual contrato respondeu.
- [DECISÃO VIGENTE] Criação em massa usa o importador oficial, nesta ordem:
  preview → revisão do plano/avisos → execute com confirmação. Alterações
  pequenas continuam usando as tools granulares.
- [FATO CONFIRMADO] Conteúdo usa o RPC oficial
  `import_app_piteco_super_package_current`, com `request_id` estável,
  `card_conflict` explícito e `destination_plan` indexado. Glossário usa
  `import_folder_glossary_v2`, com `merge`/`replace` e `dry_run`.
- [FATO CONFIRMADO] O caminho do conteúdo reutiliza o schema Smart Import 2.0,
  `parseAnySmartImportSource`, normalização, adapters e validação de destino
  existentes; não há escrita direta de tabelas nem segundo importador.
- [LIMITE] O MCP expõe nesta fase somente destinos pessoais do proprietário.
  Turmas e destinos institucionais não são aceitos pelos novos importadores.
  Campos ricos preservados pelo contrato incluem exemplos, contexto,
  explicações, notas de uso, erros comuns, word hints, glossário e grupos em
  camadas.

## Autoridade de destino e pré-checagens (correção de review)

- [DECISÃO VIGENTE] O caminho de importação resolve pasta e lista de destino
  pelo catálogo que espelha o contrato do RPC oficial — `folders.owner_id` /
  `lists.owner_id` da conta, `system_kind = 'user'`, `class_id IS NULL`,
  `deleted_at IS NULL` e instituição nula no escopo pessoal. O caminho de
  leitura usa autoridade por pasta; misturar as duas autoridades deixava o
  preview prometer algo que o executor rejeitaria.
- [DECISÃO VIGENTE] O plano default nunca escolhe em silêncio: se dois
  destinos existentes compartilham o nome, a operação retorna `ambiguous` com
  os candidatos (referência humana quando existir) e exige `destination` ou
  `destination_plan`.
- [DECISÃO VIGENTE] Preview e execute replicam a pré-checagem do gateway:
  `card_conflict = 'replace'` com qualquer card `type: "layered"` falha com
  `E_LAYERED_REPLACE_UNSUPPORTED` antes de qualquer chamada ao backend.
- [DECISÃO VIGENTE] As leituras da biblioteca (`fetchLibrarySnapshot` e o
  folder de `ListDetail`) tentam as colunas opcionais do mais rico ao mais
  seguro — `emoji`+`reference_id` → `emoji` → `reference_id` → nenhuma — para
  que a ordem merge/migration não derrube a tela de pastas. A leitura pública e
  os caminhos MCP continuam exigindo a migration.
- [FATO CONFIRMADO] As migrations desta entrega são
  `20260914130000_piteco_reference_ids.sql` (colunas, geração, backfill,
  unicidade, imutabilidade), `20260914132000_lists_with_card_counts_reference_id.sql`
  (o RPC usado por `Folder.tsx` passa a devolver o alias) e
  `20260914133000_import_capabilities_glossary.sql` (RPC de capabilities
  aditivo que publica o diagnóstico do glossário v2). Nenhuma foi aplicada em
  produção.

## Bundle e publicação

- [FATO CONFIRMADO] `supabase/functions/mcp/index.ts` é artefato gerado; nunca
  editar manualmente. A ordem correta é `build` primeiro e `mcp:bundle`
  depois, porque o plugin Vite reescreve o wrapper com caminho absoluto do
  Windows (`npm:C:\...`) e invalida o artefato.
- [FATO CONFIRMADO] Estado atual do bundle: 29 tools, `mcp:bundle:check` =
  `BUNDLE_CHECK_PASS`, zero ocorrências de `npm:C:` e `npm:@/`. O manifesto
  `.lovable/mcp/manifest.json` e o catálogo `docs/mcp/PITECO-MCP-TOOLS.json`
  listam as mesmas 29 tools.
- [FATO CONFIRMADO] A etapa foi commitada como `ffc92270` na branch
  `feat/mcp-reference-importers` e integrada ao `main` do GitHub pelo PR
  [#401](https://github.com/PedroLuis-Ape/flash-teacher-buddy/pull/401)
  (merge commit `720ae797`), em 2026-09-14. Ainda NÃO houve: aplicação das
  migrations, deploy da Edge Function `mcp` nem publicação.

## Próximo passo

Aplicar as migrations em ambiente controlado, revisar RLS/políticas existentes
e executar smoke autenticado pequeno pelo MCP: capabilities, preview e lote de
3–5 cards, incluindo retry, campos ricos, glossário e escopo. Registrar a
resposta real antes de considerar a integração pronta para publicação. As
referências só aparecem depois da migration, mas a biblioteca não quebra sem
ela: a leitura tenta as colunas opcionais do mais rico ao mais seguro.

## Revisão cruzada independente — 2026-09-14

- [FATO CONFIRMADO] A revisão independente (Luna High) devolveu `FAIL` em uma
  rodada: um achado HIGH de bundle inválido — que era artefato de tempo, porque
  ela leu o arquivo durante o `vite build`, antes da regeneração — e quatro
  achados MEDIUM. O HIGH foi revalidado depois do pipeline:
  `BUNDLE_CHECK_PASS tools=29`, 8009 linhas, zero `npm:C:`/`npm:@/`.
- [FATO CONFIRMADO] Corrigido: referência em minúsculas era aceita pelo schema
  e não resolvia (comparação sem normalização). Agora o schema reutiliza
  `referenceIdKind` e a comparação normaliza os dois lados; há teste com
  `f-k7m2q9`.
- [FATO CONFIRMADO] Corrigido: o catálogo do MCP não filtrava `class_id` e
  `institution_id` nas listas e não selecionava `lang_a`/`lang_b`, então a
  pré-checagem de consolidação comparava com o default `en`/`pt` e podia
  recusar um destino válido. O catálogo agora aplica o escopo pessoal completo e
  traz as configurações reais; há testes positivo e negativo de consolidação.
- [PENDENTE] A revisão também apontou dois comportamentos PRÉ-EXISTENTES do
  fluxo interativo da UI (`destinationCatalog.ts` não aplica todo o escopo, e
  `destinationModes.ts` escolhe em silêncio quando duas listas têm o mesmo
  nome). Não foram alterados nesta entrega para não mudar comportamento fora do
  escopo sem revisão; ficam registrados em [[08-RISKS]].

Related: [[areas/mcp-agent-api]] · [[07-TESTS]] · [[08-RISKS]]
