# App Piteco / APE — instruções para agentes

## Fatos de ambiente que não podem ser reinterpretados

- A publicação do frontend é feita exclusivamente pela Lovable.
- O backend que contém contas e dados de produção é `ymahldldyxvwjeruaxpr`.
- O projeto Supabase gerenciado para administração, migrations e diagnósticos é `xrnfhhoxmmstagmelvyi`.
- Não troque project refs, chaves, Auth, RLS, migrations, RPCs ou fronteiras público/privado sem uma tarefa explícita, testes específicos e evidência de rollback.
- Nunca crie dados fictícios para mascarar falhas de descoberta pública.

## Segundo Cérebro e aprendizado adaptativo — condicional e seletivo

Memória seletiva: **não ler e não gravar é o resultado normal** em tarefa simples ou local.
Política canônica (fonte única; não duplicar o texto aqui): `C:\Users\pedro\.codex\policies\second-brain-policy.md`.

Níveis de leitura: **0** simples/local (CSS, texto, tipagem, lint, teste, erro evidente) → nada;
**1** normal → no máximo o índice; **2** sistema conhecido (persistência, flashcards, auth, importação,
banco, arquitetura, progresso, gamificação) → índice e 1 ou poucas notas do domínio, parando quando
houver contexto suficiente; **3** exige histórico (decisão arquitetural, bug dependente de histórico,
contradição, retomada antiga) → busca direcionada (`rg`), somente o que responde à pergunta.

Regras de custo: nada de leitura recursiva nem vault inteiro; **busca antes de leitura** (`rg` pelo
termo, abrindo só o arquivo/trecho útil); documento grande se lê por trecho; `brain-manifest.json`
(~70 KB, artefato derivado) só por filtro.

As Skills `piteco-second-brain-protocol` (recuperação/registro seletivo) e `piteco-adaptive-learning-loop`
(aprendizado com evidência) são **opcionais**: entram quando a tarefa realmente precisar delas.

O vault do Obsidian (`C:\Users\pedro\Documents\App-Piteco-Brain`) e `docs/brain/` são a MESMA memória:
`docs/brain/` é a cópia versionada e reconciliada; Git é a fonte de verdade da implementação e a memória
registra intenção, decisões, contratos, riscos e handoff. Não criar segunda estrutura de memória.

Quando a tarefa exigir memória:

1. abrir o índice `docs/brain/00-HOME.md` e seguir apenas o domínio afetado;
2. de `01-CURRENT-STATE.md`, ler somente o bloco **FECHAMENTOS** mais recente — nunca o arquivo inteiro
   (60+ KB); o mesmo vale para qualquer nota grande: busca primeiro, trecho depois;
3. comparar o que recuperou com o código/Git atual e marcar informação obsoleta;
4. usar `piteco-adaptive-learning-loop` apenas se houver valor material de aprendizado.

Durante o trabalho, separar fato de hipótese, preferir a menor tentativa
informativa, registrar evidência externa e manter relações importantes por
links internos em formato `[[Nome-da-nota]]`.

Se o loop de aprendizado for usado: comparar expectativa com resultado, diagnosticar a causa com
evidência, corrigir, repetir o mesmo teste e uma regressão, e extrair lição somente quando escopo e
limitações estiverem justificados. Anti-pattern, playbook e mudança de `SKILL.md` exigem promoção explícita.

Antes de concluir (somente quando houver conhecimento durável novo — não atualizar é normal):

1. atualizar a nota-fonte existente (área / decisões / bugs / riscos / `CURRENT-STATE`), sem criar
   versão contraditória ao lado;
2. manter Properties/YAML e wikilinks válidos, sem nota órfã;
3. rodar `npm run brain:check` e os gates técnicos aplicáveis;
4. o bloco `ADAPTIVE LEARNING` no relatório final só aparece quando o loop de aprendizado foi usado.

O trabalho não exige memória atualizada para ser considerado completo. Exige que, **se** um contrato,
decisão ou risco já documentado mudou, a nota-fonte existente seja atualizada.

## Custo de contexto — READ ONCE -> COMPACT -> SHARE -> REUSE (quando houver memória)

Consultar o Segundo Cérebro é custo UMA VEZ por tarefa, não um ritual por agente.
Regra completa em `docs/brain/27-CONTEXT-PACKET-E-TELEMETRIA.md`.

1. **READ ONCE** — ler o mínimo útil: o índice `docs/brain/00-HOME.md` e, no máximo, as notas do
   domínio afetado. `docs/brain/brain-manifest.json` é artefato derivado e grande: consulte por filtro
   (`rg`), nunca integralmente. Não ler o vault inteiro.
2. **COMPACT** — transformar a leitura em um CONTEXT PACKET
   (`node scripts/context-packet.mjs new --task <id> --objective "<texto>" --domain <dominio>`)
   com objetivo, regras relevantes, contratos, decisões, riscos, arquivos,
   "não quebrar" e incertezas abertas, mais ponteiros com `sha256`. O packet não
   copia o vault.
3. **SHARE** — entregar o MESMO packet a worker, reviewer e correção
   (`node scripts/context-packet.mjs show --packet <arquivo> --actor worker`).
4. **REUSE** — quem recebeu um packet válido NÃO refaz o preflight completo;
   presume o packet válido até evidência contrária
   (`node scripts/context-packet.mjs validate --packet <arquivo>`).

- Invalidação SOMENTE por mudança material: objetivo/escopo, nota referenciada
  alterada (`REF_CHANGED`) ou removida, contrato/decisão/risco referenciado
  alterado, ou mudança de domínio. Nunca por tempo decorrido nem por "reler para
  ter certeza"; drift global do vault é reportado como `DRIFT` e não obriga
  reconstrução.
- Lacuna material durante a execução: ler UMA nota
  (`node scripts/context-packet.mjs read --packet <arquivo> --note-path <nota>`) e
  fazer PATCH do packet (`node scripts/context-packet.mjs patch --packet <arquivo> --reason "<motivo>"`),
  nunca reconstruir ou reler o vault.
- O REVIEWER recebe objetivo, regras relevantes, diff, testes, evidências e
  riscos pelo packet e NÃO relê o vault inteiro.
- Ao encerrar, atualizar somente conhecimento durável e registrar o custo de
  contexto da tarefa: `node scripts/brain-telemetry.mjs report --task <id>`.
- Estimativa declarada de tokens: `tokens = ceil(bytes / 4)`. O ledger
  `.superpowers/sdd/brain-telemetry.jsonl` é append-only.
- `docs/brain/brain-manifest.json` é artefato derivado:
  `node scripts/brain-index.mjs` regenera e
  `node scripts/brain-index.mjs --check` falha se estiver desatualizado.

## Acordos de trabalho

- Nunca trabalhe diretamente em `main`.
- Faça uma alteração principal por PR e declare a hipótese que ela testa.
- Não faça merge, deploy, publicação, migration remota ou gravação em produção automaticamente.
- Antes de editar, leia os arquivos relevantes e os PRs recentes para não reintroduzir regressões já corrigidas.
- Prefira a menor mudança verificável e não adicione dependências de produção sem necessidade clara.
- Preserve identidade visual, privacidade, acessibilidade e compatibilidade mobile.
- Não use keyword stuffing, cloaking, texto oculto, páginas automáticas em massa, backlinks artificiais ou afirmações não verificadas.

## Validação mínima

Depois de alterações relevantes, execute os comandos aplicáveis:

- `npm run typecheck`
- `npm run test`
- `npm run lint`
- `npm run build`
- `npm run seo:visibility:score`

Quando a alteração afetar publicação, SEO ou páginas públicas, inspecione também o HTML em `dist`, canonical, JSON-LD, sitemap, robots, llms.txt e os relatórios de pré-renderização.

## Loop de visibilidade SEO/GEO

Para tarefas de encontrabilidade, leia primeiro:

- `docs/seo-visibility-loop.md`
- `prompts/codex-seo-visibility-loop.md`
- `config/seo-visibility-queries.json`

Regras do loop:

1. Registre o baseline antes de alterar qualquer arquivo.
2. Classifique o gargalo antes de propor solução.
3. Faça uma melhoria focada por iteração.
4. Reexecute a avaliação depois de cada mudança significativa.
5. Mantenha um log em `reports/seo-visibility/`.
6. Pare após no máximo 6 iterações técnicas na mesma execução.
7. Use no máximo uma hipótese de código por ciclo externo de descoberta de 14 dias.
8. Não interprete ausência imediata em buscas como falha da última alteração; mecanismos de busca e assistentes têm latência de descoberta e indexação.
9. O loop rápido pode corrigir código, conteúdo, HTML e testes. O loop lento de descoberta é observacional e deve terminar em hipótese/PR, não em edição infinita.
10. Se o sinal externo for ambíguo, pare e documente a incerteza.

## Critérios de parada

O agente deve parar e preparar um PR para revisão quando ocorrer qualquer uma destas condições:

- todos os gates determinísticos passam e a pontuação local é pelo menos 95;
- seis iterações técnicas foram concluídas;
- a próxima ação exige deploy, acesso administrativo, Search Console, Bing Webmaster ou escrita em produção;
- o problema identificado é autoridade externa, indexação pendente ou ausência de dados suficientes;
- uma alteração adicional aumentaria risco de privacidade, regressão ou superotimização.

## Regras de revisão de código

- Confirme que o diff corresponde à hipótese declarada.
- Procure vazamento de conteúdo privado, canonical incorreto, noindex indevido e URLs privadas em sitemap ou llms.txt.
- Rejeite claims promocionais sem fonte e recursos planejados apresentados como existentes.
- Rejeite qualquer fallback que invente professor, material, contagem ou publicação.
- Verifique que falhas de descoberta continuem visíveis e diagnosticáveis.

## Preview Safety Gate permanente

- A última versão verde de `main` é a referência LKG do frontend.
- Toda alteração de bootstrap, roteamento, configuração, autenticação ou dependência deve passar por `npm run preview:smoke` antes de publicação.
- A rota `/__preview-health` deve continuar independente de Supabase, sessão, dados de usuário e chaves.
- Falhas de configuração, bootstrap ou componente devem renderizar uma tela técnica recuperável com versão, build e identificador; nunca deixar o `#root` vazio.
- Não mascarar falhas com dados fictícios, remoção silenciosa de conteúdo, limpeza automática de dados ou troca de projeto Supabase.
- O CI deve usar instalação limpa pelo lockfile e executar o workflow `Preview Safety Gate`.
- Publicação continua sendo responsabilidade exclusiva da Lovable; o agente prepara e valida o PR, mas não publica nem faz rollback remoto automaticamente.

## Banco oficial — regra dura (App Piteco)

- **Dados de produção = `ymahldldyxvwjeruaxpr`.** É ali que vivem contas, pastas,
  listas, flashcards, glossários, favoritos, progresso e sessões — e é ali que
  migration/deploy de dados devem ser aplicados.
- **`xrnfhhoxmmstagmelvyi` é o projeto administrado por ferramentas/transição**
  (tem 0 pastas, 0 listas e 0 cards). `supabase/config.toml` aponta para ele: é
  armadilha de tooling, não destino de dados.
- Fonte única no código: `src/integrations/supabase/platformRuntime.ts`
  (`PRODUCTION_DATA_PROJECT_ID`). O arquivo carrega um *AI EDITOR GUARD*: não
  trocar essas constantes e não “consertar” app vazio mexendo nelas.
- Antes de qualquer migration, deploy ou diagnóstico de “sumiu dado”, rode
  `node scripts/check-platform.mjs` e confirme a saída
  `production data runtime ymahldldyxvwjeruaxpr`. Contexto completo em
  `docs/orientacao-banco-correto.md` e `docs/brain/areas/supabase-runtime.md`.

## Time CLARA — subagentes padrão (Codex)

Subagentes neste repositório são, por padrão, as Claras. Ao spawnar, passe sempre `agent_type`
explícito: sem papel, o Codex usa nome aleatório e o subagente não recebe as instruções da Clara.

- `clara_brain` (Clara Brain) — memória operacional: lê `docs/brain/` e devolve o Context Packet mínimo
  antes de tarefa não trivial; registra somente conhecimento durável.
- `clara_explorer` (Clara Explorer) — reconhecimento read-only; devolve Exploration Pack com evidência.
- `clara_worker` (Clara Worker) — implementação no escopo aprovado; devolve Implementation Report.
- `clara_reviewer` (Clara Reviewer) — revisão independente; devolve Review Report com severidade.

Fluxo padrão: Brain (contexto) → Explorer (mapa) → Worker (implementação) → Reviewer (revisão)
→ Brain (conhecimento durável registrado em `docs/brain/`).

### Modelo e esforço (decisão vigente de 2026-09-14)

- Todo subagente nasce com `model = gpt-5.6-luna` e `reasoning_effort = high`. Vale para worker,
  reviewer, exploração, QA, investigação, memória/contexto e agentes temporários.
- A MAIN mantém exatamente o modelo e o esforço que o usuário configurou; delegar não altera a MAIN.
- Não usar `xhigh` nem `ultra`, e não escalar automaticamente (High → Extra High → Ultra → Astra).
- Luna High não conseguiu executar: o subagente devolve BLOCKED com evidência e a MAIN decide,
  inclusive trocar de modelo, com motivo registrado.
- A decisão de 2026-09-12 de fixar as Claras em DeepSeek `deepseek/deepseek-v4-flash` com esforço
  `ultra` está **substituída** por esta.

Limites que valem para toda Clara neste projeto:

- valem os “Acordos de trabalho” acima: não trabalhar em `main`, uma alteração principal por PR,
  sem merge, deploy, publicação, migration remota ou gravação em produção automática;
- subagentes não tocam Supabase, RLS, Auth, dados de produção, importadores nem persistência sem
  tarefa explícita, testes específicos e evidência de rollback;
- escopos de escrita disjuntos; cada entrega informa arquivos alterados, testes executados,
  limitações e commit lógico;
- subagente concluído é encerrado antes de abrir o próximo;
- no máximo duas rodadas automáticas de correção (CRITICAL/HIGH); achado LOW/INFO vai para o
  relatório final;
- memória é carregada de forma seletiva (`README`/`00-HOME` → nota relevante → packet compartilhado),
  nunca o vault inteiro;
- memória segue a política seletiva: preflight só quando a tarefa exigir e fechamento só com
  conhecimento durável; as Claras executam o trabalho e não substituem os gates técnicos.

## Criação e importação de flashcards

Criar, enriquecer, organizar ou importar flashcards segue `FLASHCARD_AGENT.md` como fonte
operacional do fluxo (fonte → análise semântica → seleção → pasta → lista → card → enriquecimento →
glossário → validação → destination plan → Super Import). O schema ativo, os importadores oficiais e
o banco continuam sendo a autoridade final; o documento não cria contrato paralelo.
