# App Piteco / APE — instruções para agentes

## Fatos de ambiente que não podem ser reinterpretados

- A publicação do frontend é feita exclusivamente pela Lovable.
- O backend que contém contas e dados de produção é `ymahldldyxvwjeruaxpr`.
- O projeto Supabase gerenciado para administração, migrations e diagnósticos é `xrnfhhoxmmstagmelvyi`.
- Não troque project refs, chaves, Auth, RLS, migrations, RPCs ou fronteiras público/privado sem uma tarefa explícita, testes específicos e evidência de rollback.
- Nunca crie dados fictícios para mascarar falhas de descoberta pública.

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
