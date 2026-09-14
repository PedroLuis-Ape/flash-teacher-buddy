---
category: bug
cssclasses:
  - ape-ai-note
type: risk-register
area: release
status: active
related:
  - "[[01-CURRENT-STATE]]"
  - "[[areas/visual-polish]]"
  - "[[07-TESTS]]"
  - "[[12-PROCESS-LOG-2026-09-11]]"
  - "[[README]]"
  - "[[learning/00-LEARNING-HUB]]"
---

# Riscos

- A correção de safe-area pode ficar correta no CSS e ainda falhar em um viewport real com inset não zero.
- Dialogs com footer longo podem esconder a ação primária quando o teclado virtual aparece.
- Alterar componentes Radix compartilhados pode causar regressão em muitas rotas; preferir classes explícitas e mudanças mínimas.
- O worktree possui alteração pré-existente em função Supabase; staging amplo pode incluí-la por engano.
- O preview Lovable pode não estar conectado à mesma revisão do GitHub.
- O projeto Lovable auditado é privado para a conta conectada `pedro55luizy@gmail.com`; a comparação direta no editor depende de concessão de acesso pelo proprietário.
- A sessão CUA atual não expõe o Chrome autenticado; o navegador interno abriu o Lovable sem sessão e repetiu `You don't have access`. A validação precisa de uma aba autenticada acessível.
- O controle direto do Windows falhou antes da enumeração de janelas com `Trusted RPC service is not configured: sky`; não operar o desktop por caminhos alternativos.
- O Chrome conectado redirecionou o Lovable para `/login`; nenhum provedor ou credencial foi acionado. A inspeção do preview depende de login manual nessa aba.
- A capacidade de agentes tem limite de threads; relatórios de auditoria não substituem validação própria.
- O navegador publicado pode conter dados de teste e não deve ser usado para operações destrutivas.
- A auditoria global da publicação registrou avisos pré-existentes de `PortalHistorySync`, `EconomyContext` e múltiplas instâncias do GoTrueClient; investigar em tarefa funcional separada, sem misturar com polish visual.
- O preview local não recebeu a sessão do usuário nem credenciais; o shell do Hub abriu, mas o deck público precisa de configuração de runtime para validar dados reais localmente.
- Na checagem final, o ID público de amostra retornou `Lista não encontrada` no Hub publicado, embora a pasta pública ainda liste suas três listas; investigar como incidente funcional/de publicação separado.
- O merge local em `main` não equivale a publicação no Lovable; a revisão do preview autenticado continua pendente.
- `origin/main` foi atualizado com sucesso para `ddc6f89a`; o Lovable ainda precisa detectar/sincronizar essa revisão antes da publicação.
- A integração das Skills e `docs/brain/` está na branch de trabalho
  `codex/piteco-memory-skills-20260911`, commit `891b3a46`; revisar o diff antes
  de mesclar.
- O checker considera as notas fora de `imports/` como memória ativa e apenas
  resolve referências explícitas para o histórico importado; mudanças nessa
  política exigem atualizar a especificação e os testes.
- O contrato de runtime está correto no core, mas consumidores auxiliares ainda
  leem `VITE_SUPABASE_*` diretamente; auditar antes de prometer imunidade total
  a configuração divergente. Ver [[areas/supabase-runtime]].
- A primeira fatia do Motion System tem implementação e QA local, mas não deve
  ser tratada como entrega global antes da revisão autenticada e da matriz de
  interação. Ver [[areas/motion-system]].
- A primeira fatia do Motion System passou no preview local, mas ainda não foi
  comparada no preview Lovable autenticado. Não expandir para Home, menus,
  progresso ou assinaturas específicas sem essa revisão visual. A expansão
  local foi autorizada e implementada; a comparação externa continua sendo
  uma limitação de release, não uma falha dos gates locais.
- O usuário aprovou a especificação e autorizou a expansão completa. O risco
  agora é regressão de interação/semântica ao trocar classes de superfícies
  compartilhadas; manter mudanças pequenas, testes de contrato e exclusão
  explícita de lógica de dados.
- A expansão introduziu classes compartilhadas em componentes de alto alcance
  (`Progress`, Dialog/Popover/Tooltip e navegação). O próximo gate deve
  verificar overflow, foco, reduced motion e ausência de deslocamento de layout
  em rotas reais antes do release.
- Regras específicas de microinteração podem perder para utilitários genéricos
  de hover; manter contratos por modo e conferir a precedência no CSS compilado
  quando novos efeitos forem acrescentados.
- O fechamento técnico local não prova publicação no Lovable: a aba autenticada
  do preview não ficou acessível nesta sessão. Publicar somente após a
  sincronização e conferência final no ambiente de destino.
- A extensão a cards de loja e sala de aula mantém interações de compra e
  navegação existentes; retestar essas rotas é obrigatório porque o papel
  compartilhado tem alcance visual transversal.

## Estado de integração — 2026-09-11

- [VERIFIED-REPO] O `main` local recebeu a branch de Motion por merge
  `e4f36f44` após incorporar o `origin/main` em `2b477d80`.
- [VERIFIED-REPO] O contrato textual de reforço foi alinhado ao rótulo atual
  `Reforço`; a suíte pós-merge passou.
- [REVALIDATE] Merge no GitHub e sincronização/publicação do Lovable só podem
  ser tratados como confirmados após a resposta do push e a leitura do remoto.
- [REVALIDATE] `supabase/functions/mcp/index.ts` continua com mudança local
  pré-existente e deliberadamente não foi incluído.

Related: [[12-PROCESS-LOG-2026-09-11]] · [[areas/motion-system]] · [[areas/supabase-runtime]]

## Catálogo público — 2026-09-13

- [REVALIDATE] Sem linhas aprovadas/indexáveis, os cards não puderam ser
  inspecionados visualmente com conteúdo real; preservar o empty state honesto.
- [RESOLVIDO] O payload bem-sucedido da RPC não pode mais ser normalizado
  silenciosamente para vazio: qualquer estrutura ausente ou de tipo incorreto
  lança erro e ativa o fluxo recuperável de retry.
- [KNOWN-LIMIT] No SPA local, o canonical raiz estático do shell permanece ao
  lado do canonical da rota emitido por `SEOHead`. O catálogo cumpre as props
  desta task, mas o pipeline SEO compartilhado deve eliminar a duplicidade.

Related: [[01-CURRENT-STATE]] · [[07-TESTS]] · [[sessions/2026-09-13-public-catalog-task-2]]
## R-2026-09-13-01 — Autoria inventada em JSON-LD de páginas públicas irmãs (P2)

[VERIFIED-REPO] O defeito corrigido na Fase 5 no material curado (`name:
"Professor no APE"` + `jobTitle: "Professor"` emitidos sem autor no payload)
**continua presente** em quatro caminhos públicos que já estão no ar:

- `scripts/prerender-public-learning-resources.mjs:136-137` (nó `Person`) e `:128`
  (referência `author`)
- `scripts/prerender-public-learning-lists.mjs:103-104` e `:92`
- `src/components/seo/publicLearningResourceStructuredData.ts:90-91` e `:82`
- `src/components/seo/publicLearningListStructuredData.ts:95-96` e `:79`

Correção exigida (mesma do material): só emitir o nó `Person` e a referência
`author` quando existir `author_display_name` ou `author_slug`; sem autor, o
`@graph` não pode conter `Person` nem `author`.

Por que não foi corrigido junto: cada arquivo exige dois gates (nó + referência)
em quatro arquivos de fases anteriores, e um gate malfeito deixa referência
pendurada em dados estruturados de páginas vivas. Exige task própria com teste.

[DECISION] Registrado como dívida acionável em vez de corrigido às pressas sem
revisão dedicada.

### Desfecho — RESOLVIDO — 2026-09-13

- [FATO CONFIRMADO] R-2026-09-13-01 foi resolvido pelo commit `1112091a`.
  Os quatro builders de JSON-LD agora só emitem `Person` e a referência
  `author` quando existe `author_display_name` ou `author_slug`.
- [FATO CONFIRMADO] O teste Vitest de autoria, os dois validadores de
  pré-render, typecheck e build/SEO foram executados; a varredura do `dist`
  registrou 35 blocos JSON-LD, 0 referências penduradas e 0 `null`/`undefined`.
- [NEEDS_RECONCILIATION] O ramo sem autor foi validado por fixture sintética;
  revalidar quando existir pasta/lista pública real sem autor. Isso é uma
  limitação de cobertura, não uma reabertura do risco corrigido.

## R-2026-09-13-02 — orientação heurística de idioma no estudo

- [MITIGATED] A inversão de orientação é deliberadamente conservadora: exige 8 pares classificados com alta confiança e 80% de consenso, ignorando frases curtas/ambíguas. Isso evita trocar rótulo por um card isolado, mas pode deixar decks multilíngues ou com pouco texto sem reconciliação automática.
- [KNOWN-LIMIT] A suíte e o typecheck não provam a fala em um navegador real; o teste atual mocka `speechSynthesis`/`useTTS` e valida `en-US`/`pt-BR` para o texto exibido.
- [FOLLOW-UP] A duplicidade de direção em `gameCore.ts`, o recálculo dos wrappers e o `PronunciationStudyView` fixado em `sideB` permanecem fora deste lote.

Related: [[sessions/2026-09-13-ab-language-orientation]] · [[06-BUGS]] · [[07-TESTS]]

## R-2026-09-13-03 — bundle auto-gerado do MCP depende do pipeline Linux

- [FATO CONFIRMADO] `@lovable.dev/mcp-js` 0.20.x no Windows externaliza o
  entry absoluto como `npm:C:\\Users\\...\\src\\lib\\mcp\\index.ts`, o que e
  invalido para Deno. O plugin so bundla de fato quando o caminho resolvido
  comeca com `/` (comportamento do pipeline oficial Linux/Lovable).
- [MITIGACAO] `npm run build` local sobrescreve esse artefato; nesta rodada o
  arquivo commitado foi restaurado com `git restore`. Antes de commitar,
  conferir `git diff -- supabase/functions/mcp/index.ts`: nao deve conter
  `npm:C:`.
- [CONSEQUENCIA] O bundle publicado precisa ser regenerado pelo pipeline
  oficial para incluir as tools novas; validar tools/list apos a regeneracao.

Related: [[areas/mcp-agent-api]] · [[sessions/2026-09-13-mcp-fase1-2-read]] · [[07-TESTS]]

## R-2026-09-13-04 — escrita do MCP: cache de vocabulário, token e RLS não exercitada

- [RISCO] invalidateVocabularyInventory limpa um Map em memória do isolate
  atual. Com mais de um isolate servindo o MCP, uma análise pode usar
  inventário de até 60 s (TTL) depois de uma escrita. Mitigação atual: TTL curto
  + invalidação no isolate que escreveu. FOLLOW-UP: versionar invalidação por
  fingerprint/updated_at consultado no banco.
- [DECISAO VIGENTE] O confirmation token destrutivo é HMAC do bearer da
  requisição e agora inclui uid, lista/escopo e o conjunto exato de IDs,
  além da contagem. Refresh de sessão entre preview e confirmação invalida o
  token e exige novo preview (falha segura, sem operação parcial).
- [NAO VERIFICADO] O isolamento entre contas na FASE 3/4 foi provado por
  filtros de posse do domínio sobre fake PostgREST; a RLS real segue não
  exercitada nesta rodada. Rodar smoke autenticado antes de publicar.
- [LIMITE CONHECIDO] duplicate_list copia até 2000 cards ativos por chamada e
  compensa falha de lote enviando a cópia parcial para a lixeira.

Related: [[areas/mcp-agent-api]] · [[sessions/2026-09-13-mcp-phase3-4]] · [[07-TESTS]]

## R-2026-09-13-05 — audit log local ainda não é trilha durável

- [FATO CONFIRMADO] FASE 7 emite `mcp.audit` via `console.log(JSON.stringify)`
  no processo do MCP para escritas e destrutivos, sem migration e sem dados
  de card/token.
- [LIMITE] Logs locais dependem do coletor/runtime e não oferecem consulta,
  retenção ou integridade de uma tabela.
- [FOLLOW-UP] Evoluir para sink/tabela de auditoria com schema, retenção,
  RLS e aprovação explícita antes de qualquer migration de produção.

Related: [[areas/mcp-agent-api]] · [[sessions/2026-09-13-mcp-phase5-7]] · [[27-CONTEXT-PACKET-E-TELEMETRIA]]

## R-2026-09-13-03 — RESOLVIDO (mitigação commitada) — 2026-09-13

- [FATO CONFIRMADO] Causa raiz: o resolver do plugin externaliza qualquer caminho que não comece com `.` ou `/`, então o caminho absoluto do Windows (`C:\...`) virava `npm:C:\...`, inválido no Deno.
- [RESOLVIDO] `scripts/build-mcp-deno-bundle.mjs` reproduz o build do plugin com especificador relativo: `npm run mcp:bundle` gera o bundle com as 24 tools e `npm run mcp:bundle:check` detecta divergência.
- [VERIFIED-GATE] Bundle gerado: 202108 bytes, 24 tools, imports `npm:@lovable.dev/mcp-js@0.20.1` / `npm:zod@^3.23.8`, zero `npm:C:`; paridade exata com `.lovable/mcp/manifest.json`.
- [REVALIDATE] Execução sob Deno e deploy real continuam não verificados (Deno ausente na máquina; deploy depende de decisão humana).


- [MITIGADO] `verify_jwt` do function `mcp` declarado explicitamente como `false` em `supabase/config.toml`, seguindo a convenção do repo (handler valida auth) e o comportamento já observado em produção (401 do SDK com `x-deno-execution-id`).


## CI vermelho no `main` (pré-existente, 2026-09-13)

- [FATO CONFIRMADO] O job **Preview Safety Gate** falha em todos os runs recentes do `main` (`8680e4a8`, `d84be800`, `6bf640c1`, `3ba95a62`): cenário `supabase-unavailable` espera `getByText('Jogar agora')` e dá timeout de 8s.
- [FATO CONFIRMADO] O step **SEO and GEO consistency audit** (`node scripts/validate-seo.mjs`) também falha no `main`: "Search bots must inherit the wildcard private-route rules; a separate group can accidentally bypass them".
- [MITIGADO NO PR] No PR #399 o único check que eu quebrei foi `mcp: função gerenciada privada deve declarar verify_jwt = true` — revertido (o function `mcp` fica não declarado, como estava). O gate local `node scripts/audit-security.mjs` volta a passar.
- [FOLLOW-UP] Consertar os dois checks de CI acima é trabalho SEPARADO deste programa (SEO/robots e preview smoke), fora do escopo do MCP.

## R-2026-09-14-01 — Reference IDs e importadores MCP aguardam backend

- [FATO CONFIRMADO] Source, manifesto, catálogo e bundle local têm 29 tools; a
  verificação local não prova que a Edge Function publicada esteja nessa
  revisão.
- [RISCO REDUZIDO] A biblioteca e o domínio MCP leem `folders.reference_id` e
  `lists.reference_id`. O código da biblioteca e de `ListDetail` agora tenta as
  colunas opcionais do mais rico ao mais seguro, então publicar antes da
  migration já não derruba a tela de pastas: a coluna ausente apenas esconde as
  referências.
- [LIMITE] O efeito colateral é que uma coluna ausente custa tentativas
  extras de query até a migration ser aplicada. As tools MCP continuam
  dependendo da migration para operar por referência.
- [MITIGAÇÃO] O bundle é gerado e conferido pelo pipeline local
  (`BUNDLE_CHECK_PASS`, 29 tools, zero `npm:C:`/`npm:@/`); o artefato não foi
  editado à mão. Antes da publicação: aplicar as três migrations com backup,
  revisar RLS e executar `tools/list`, capabilities, preview e lote pequeno
  autenticados no endpoint real.
- [MITIGAÇÃO] O preview de importação passou a espelhar o contrato do gateway
  (dono da pasta e da lista, sem turma/lixeira) e a recusar antes da chamada
  `card_conflict=replace` com camadas, então o preview não promete transação
  que o executor recusa.
- [LIMITE] A fase atual expõe importação somente para biblioteca pessoal do
  proprietário. Instituição/turma, Deno em runtime e retry real contra dados
  reais continuam sem evidência nesta rodada.

Related: [[areas/mcp-reference-ids-and-importers]] · [[areas/mcp-agent-api]] · [[01-CURRENT-STATE]] · [[07-TESTS]]

## R-2026-09-14-02 — fluxo interativo de importação da UI ainda diverge do gateway

- [FATO CONFIRMADO] A revisão cruzada independente apontou que
  `src/features/global-import/destinationCatalog.ts` não aplica `system_kind`,
  `deleted_at` e o escopo de instituição em todos os caminhos, e que
  `src/features/global-import/destinationModes.ts` usa
  `new Map(existingLists.map(... normalize(list.title) ...))`, o que escolhe em
  silêncio quando duas listas existentes têm o mesmo nome.
- [LIMITE] Esses caminhos são PRÉ-EXISTENTES e não foram alterados nesta
  entrega: a UI é interativa (o usuário confirma o destino na tela) e o gateway
  oficial continua validando dono e pasta, então o risco é de escolha errada
  visível, não de escrita fora de escopo. O caminho MCP, que não tem confirmação
  humana, já foi corrigido.
- [NEXT] Alinhar o catálogo da UI ao mesmo contrato e exigir seleção explícita
  quando o nome for duplicado, com testes de política `append`/`replace`.

Related: [[areas/mcp-reference-ids-and-importers]] · [[imports/2026-09-11/App-Piteco-Brain/areas/importers]] · [[01-CURRENT-STATE]] · [[07-TESTS]]

## R-2026-09-14-03 — atualizações de dependência pendentes (majors)

- [FATO CONFIRMADO] A auditoria de continuidade fechou as PRs de dependência porque nenhuma era mergeável sem migração validada: `vite` 6.4.3 → 8.3.0 e `vitest` 4.1.9 → 5.0.0 (#271), `react-router-dom` 6 → 7 (#171), `sonner` 1 → 2 (#172), além de dois patches com lockfile defasado (#173 radix tooltip, #174 tailwind typography).
- [RISCO] O projeto segue em toolchain antiga (`vite` 6 / `vitest` 4). Enquanto a migração não for feita em PR dedicado com `typecheck`, suíte, `lint`, `build`, `preview:smoke` e `check:dependencies`, o Dependabot continuará repropondo versões que não podem ser mergeadas direto.
- [MITIGAÇÃO] Migrar um major por PR, começando pelo toolchain (vite/vitest) porque desbloqueia os demais; regenerar os lockfiles a partir do `main` atual antes de validar.
- [LIMITE] Nada disso foi aplicado nesta rodada; o `main` continua exatamente na toolchain validada.

Related: [[sessions/2026-09-14-auditoria-de-continuidade]] · [[01-CURRENT-STATE]] · [[07-TESTS]] · [[23-GIT-E-WORKTREES]]

## R-2026-09-14-01 — emoji por pasta depende da migration para sincronização

- [FATO CONFIRMADO] O código consulta e atualiza `folders.emoji`, mas a coluna não existia no schema conhecido desta rodada.
- [MITIGACAO] A leitura recua automaticamente para a seleção anterior quando a coluna está ausente; a preferência local continua disponível e a UI informa quando a sincronização em nuvem não foi possível.
- [LIMITE] Até aplicar `supabase/migrations/20260914010000_folder_emoji.sql`, o emoji é específico do dispositivo. Não prometer sincronização entre navegadores/dispositivos.
- [MITIGACAO] A ordem de pastas não é mais uma preferência global acidental: o armazenamento local é separado por usuário/instituição; a ordem de listas é separada por pasta.
- [NEXT] Aplicar a migration em ambiente controlado, verificar RLS/política de update existente e testar marcar → sair → entrar em outro dispositivo; então remover este risco ou atualizar sua evidência.

Related: [[areas/visual-polish]] · [[01-CURRENT-STATE]] · [[07-TESTS]] · [[areas/supabase-runtime]]

