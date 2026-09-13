---
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
