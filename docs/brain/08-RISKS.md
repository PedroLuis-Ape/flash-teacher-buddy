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
