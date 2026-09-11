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
