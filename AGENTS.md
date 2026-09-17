# App Piteco / APE — instruções para agentes

## Invariantes de ambiente

- A publicação do frontend é feita exclusivamente pela Lovable.
- Dados de produção vivem em `ymahldldyxvwjeruaxpr`.
- `xrnfhhoxmmstagmelvyi` é o projeto Supabase de administração/tooling/transição; não é o banco de dados do usuário.
- Não troque project refs, chaves, Auth, RLS, migrations, RPCs ou fronteiras público/privado sem tarefa explícita, teste específico e rollback claro.
- Nunca crie dados fictícios para mascarar falha de descoberta, banco vazio ou erro de configuração.
- Git/código atual é a fonte de verdade da implementação; memória registra contexto durável, não substitui o código.

## Orçamento de contexto — padrão é NÃO carregar

Princípio: **contexto sob demanda, não contexto preventivo**. Antes de ler memória, histórico, PRs ou abrir subagentes, pergunte se essa informação pode mudar materialmente a decisão atual. Se não puder, não carregue.

Política canônica do Segundo Cérebro: `C:\Users\pedro\.codex\policies\second-brain-policy.md`. Não duplicar essa política neste arquivo.

Classificação operacional:

- **Nível 0 — simples/local:** texto, CSS, tipagem, lint, teste localizado, erro evidente, pequena edição em arquivo conhecido. Não usar Segundo Cérebro, Context Packet, telemetria de memória, histórico Git/PR ou subagente por precaução.
- **Nível 1 — normal:** começar pelo código/arquivo atual. Fazer busca direcionada apenas se necessário. Segundo Cérebro continua opcional.
- **Nível 2 — sistêmico:** persistência, auth, importação, progresso, banco, arquitetura, gamificação ou contrato compartilhado. Se contexto histórico puder mudar a solução, consultar `docs/brain/00-HOME.md` e no máximo uma ou poucas notas diretamente relevantes.
- **Nível 3 — histórico:** decisão arquitetural antiga, regressão dependente de histórico, contradição ou retomada. Fazer retrieval direcionado por termo/trecho; nunca varredura do vault.

Regras duras de custo:

- `piteco-second-brain-protocol` e `piteco-adaptive-learning-loop` são **opcionais** e só entram quando a tarefa realmente precisa deles.
- Busca antes de leitura. Documento grande é lido por trecho; nunca abrir `01-CURRENT-STATE.md` inteiro por rotina.
- `docs/brain/brain-manifest.json` é artefato derivado e grande; filtrar, nunca despejar integralmente no contexto.
- O vault `C:\Users\pedro\Documents\App-Piteco-Brain` e `docs/brain/` representam a mesma memória; não criar uma segunda memória paralela.
- Context Packet só é útil quando o mesmo contexto recuperado será reutilizado por **dois ou mais atores/etapas**. Tarefa resolvida apenas pela MAIN não precisa criar packet só por protocolo.
- Se um packet válido já existe, reutilizar. Quem o recebe não refaz preflight do Segundo Cérebro.
- Lacuna material: recuperar somente a nota/trecho faltante e, se houver packet, fazer patch; não reconstruir todo o contexto.
- Telemetria de memória serve para medir tarefas que realmente usaram memória; não deve virar ritual em tarefa nível 0/1.

Detalhe do protocolo de reutilização, somente quando aplicável: `docs/brain/27-CONTEXT-PACKET-E-TELEMETRIA.md`.

## Delegação — MAIN FIRST

**Padrão: zero subagentes.** Delegar é uma otimização para trabalho realmente separável, não uma etapa obrigatória.

- Tarefa simples/local: MAIN resolve sozinha.
- Tarefa média: no máximo **1 subagente** quando houver ganho claro de especialização, independência ou paralelismo.
- Tarefa complexa/alto risco: até **2 subagentes por padrão**. Mais do que isso exige decomposição materialmente independente e justificativa concreta.
- Não existe pipeline obrigatório `Brain → Explorer → Worker → Reviewer → Brain`.
- Proibida delegação recursiva/aninhada por padrão: subagente não cria outro subagente.
- Não abrir `clara_brain` se a tarefa não exige memória.
- Não abrir `clara_explorer` se a MAIN já sabe onde está o código relevante.
- Não abrir `clara_worker` apenas para repetir uma implementação pequena que a MAIN pode fazer diretamente.
- Não abrir `clara_reviewer` automaticamente para todo diff; usar em mudança ampla, arriscada, de contrato, segurança/persistência ou quando revisão independente trouxer ganho real.
- Encerrar um subagente concluído antes de abrir outro.

Papéis disponíveis quando necessários: `clara_brain`, `clara_explorer`, `clara_worker`, `clara_reviewer`. Ao spawnar, usar `agent_type` explícito.

### Modelo, esforço e handoff

- Luna continua sendo o modelo econômico preferido para subagentes, mas **não force `reasoning_effort = high` para todo papel e toda tarefa**.
- Memória/exploração mecânica: esforço baixo ou médio quando suficiente.
- Worker/reviewer: médio por padrão; High somente quando a complexidade ou o risco justificar.
- Sem `xhigh`, `ultra` ou escalonamento automático caro.
- A MAIN mantém o modelo/esforço escolhido pelo usuário.
- Delegado recebe somente: objetivo, arquivos/trechos relevantes, restrições, evidência necessária e um resumo/packet compacto quando houver. Não enviar histórico completo da conversa nem mandar o delegado reconstruir todo o contexto.
- Resposta interna de subagente deve ser curta e orientada a resultado: achados, arquivos, testes, risco/bloqueio. Não produzir ensaio ou diário de raciocínio.

## GitHub, Git e repositório — acesso seletivo

- Reutilize checkout/worktree local válido. **Não clone o repositório apenas para obter contexto** quando já existe checkout ou uma consulta pontual resolve.
- Primeiro localize o arquivo relevante; depois leia somente o necessário. Não faça scan da árvore inteira por padrão.
- Não rode `git log`, diff amplo, busca de branches, leitura de PRs recentes ou histórico remoto por rotina. Use histórico somente quando regressão, autoria, decisão anterior ou comparação realmente depender dele.
- A regra antiga “ler PRs recentes antes de editar” não é geral: PRs são consultados sob demanda.
- GitHub é fonte de código/colaboração, não extensão automática do Segundo Cérebro.
- Não criar commits, documentos, relatórios ou notas no repositório apenas para o agente se lembrar do que fez.
- Não atualizar `docs/brain/` a cada tarefa. Atualização de memória é exceção: somente conhecimento durável novo ou contrato/decisão/risco documentado que realmente mudou.

## Fechamento do Segundo Cérebro — somente quando houve mudança durável

Se a tarefa produziu conhecimento durável que precisa ser preservado:

1. atualizar a nota-fonte existente, sem criar versão contraditória ao lado;
2. manter YAML/wikilinks válidos;
3. rodar `npm run brain:check` quando `docs/brain/` foi alterado;
4. registrar aprendizado adaptativo somente se o loop de aprendizado foi de fato usado.

**Não ler/gravar memória é um encerramento válido e esperado para a maioria das tarefas locais.**

## Acordos de trabalho

- Nunca trabalhe diretamente em `main`; use branch/worktree isolado.
- Uma alteração principal por PR, com hipótese/objetivo claro.
- Não fazer merge, deploy, publicação, migration remota ou gravação em produção automaticamente.
- Leia os arquivos diretamente envolvidos antes de editar. Consulte histórico somente se a tarefa depender dele.
- Prefira a menor mudança verificável; não adicione dependência de produção sem necessidade clara.
- Preserve identidade visual, privacidade, acessibilidade e compatibilidade mobile.

## Validação proporcional

Validação também segue orçamento. Não faça todos os gates em cada subagente.

- Comece pelo teste/typecheck/lint **mais focado** que cubra a mudança.
- A MAIN/coordenador consolida os gates; subagentes não precisam repetir a suíte completa já coberta por outro ator.
- `npm run typecheck`, `npm run test`, `npm run lint` e `npm run build` entram conforme o alcance da alteração.
- `npm run seo:visibility:score` somente em tarefa de SEO/GEO/encontrabilidade.
- `npm run preview:smoke` quando bootstrap, roteamento, configuração, autenticação, dependência ou publicação puderem afetar o preview.
- Se um gate já passou no mesmo commit/estado e nada relevante mudou, não repita apenas por ritual.

## Rotas de contexto por domínio — carregar somente quando o domínio for tocado

### Banco / Supabase

Produção = `ymahldldyxvwjeruaxpr`; tooling/transição = `xrnfhhoxmmstagmelvyi`. Antes de migration/deploy/diagnóstico de dados, rode `node scripts/check-platform.mjs`. Contexto detalhado: `docs/orientacao-banco-correto.md` e `docs/brain/areas/supabase-runtime.md`.

### SEO / GEO

Somente em tarefas de encontrabilidade, consultar `docs/seo-visibility-loop.md`, `prompts/codex-seo-visibility-loop.md` e `config/seo-visibility-queries.json`. Não carregar esse material em trabalho comum de produto.

### Preview / publicação

Somente quando relevante, aplicar o Preview Safety Gate e manter `/__preview-health` independente de Supabase/sessão. Publicação continua exclusiva da Lovable.

### Flashcards / importação

Somente ao criar, enriquecer, organizar ou importar flashcards, usar `FLASHCARD_AGENT.md` como fonte operacional; schema ativo, importadores oficiais e banco continuam autoridades finais.

## Critério final

A execução ideal carrega o **mínimo contexto que consegue mudar a decisão**, usa o **mínimo número de agentes que melhora o resultado** e executa o **mínimo conjunto de gates que prova a mudança**. Qualidade não é medida pela quantidade de arquivos lidos, agentes abertos ou relatórios produzidos.
