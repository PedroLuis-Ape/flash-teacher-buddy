# Prompt mestre — APE Search Visibility Experiment Loop

Você está trabalhando no repositório do App Piteco / APE. Sua missão é executar um loop de melhoria orientado por avaliações para aumentar a encontrabilidade e a citabilidade verificável do produto, sem manipular mecanismos de busca e sem alterar produção automaticamente.

## Regras obrigatórias antes de começar

1. Leia `AGENTS.md` por completo.
2. Leia `docs/seo-visibility-loop.md`.
3. Leia `config/seo-visibility-queries.json`.
4. Inspecione o estado atual da branch, os arquivos SEO, a landing, os scripts de pré-renderização e os PRs recentes relevantes.
5. Confirme que não está em `main` e que a árvore de trabalho começou limpa.
6. Não faça merge, deploy, migration remota, alteração de Auth/RLS ou escrita em produção.

## Objetivo desta execução

Melhorar o estado técnico e editorial do repositório até que:

- `npm run seo:visibility:score` alcance pelo menos 95;
- todos os gates críticos passem;
- typecheck, testes, lint e build passem;
- o HTML pré-renderizado seja inspecionado diretamente;
- a alteração principal esteja vinculada a uma hipótese explícita;
- privacidade e fronteiras público/privado permaneçam intactas.

A ausência do APE em resultados externos durante a mesma execução não autoriza mudanças sucessivas. Resultados de busca têm latência. Esta execução pode registrar um baseline externo, mas deve implementar no máximo uma hipótese de código relacionada a esse baseline.

## Fase 1 — Baseline

Antes de editar:

1. Execute os checks atuais aplicáveis.
2. Execute:
   - `npm run build`
   - `npm run seo:visibility:score`
3. Leia o relatório `reports/seo-visibility/latest-eval.json`.
4. Inspecione:
   - `dist/index.html`;
   - `dist/sitemap.xml`;
   - `dist/robots.txt`;
   - `dist/llms.txt`;
   - relatórios de pré-renderização;
   - canonical, JSON-LD, H1, FAQ visível e links internos.
5. Caso o acesso à internet esteja habilitado, execute o benchmark fixo de `config/seo-visibility-queries.json` e salve um relatório em `reports/seo-visibility/benchmarks/YYYY-MM-DD.json`.
6. Não inclua dados privados nem invente resultados que não conseguiu observar.

## Fase 2 — Classificação do gargalo

Classifique o problema principal em exatamente uma categoria:

- publicação ou rota ausente;
- rastreamento bloqueado;
- indexação pendente;
- identidade APE / App Piteco inconsistente;
- conteúdo principal ausente do HTML inicial;
- canonical, hreflang ou JSON-LD inconsistente;
- sitemap ou llms.txt incompleto;
- descoberta pública vazia ou mascarada;
- links internos insuficientes;
- conteúdo superficial ou pouco diferenciador;
- performance ou acessibilidade;
- privacidade;
- autoridade externa, sem correção técnica justificável;
- dados insuficientes para agir.

Registre a classificação e a evidência antes de editar.

## Fase 3 — Hipótese

Escreva uma hipótese testável no formato:

> Observamos X. A causa provável é Y. A menor alteração verificável é Z. Esperamos melhorar os indicadores A e B sem alterar C.

Escolha somente uma hipótese principal para esta execução.

## Fase 4 — Loop técnico

Repita no máximo 6 vezes:

1. Faça uma melhoria focada.
2. Evite refatorações ou mudanças visuais não relacionadas.
3. Execute os testes diretamente relacionados.
4. Execute build e `npm run seo:visibility:score` após mudanças significativas.
5. Inspecione os artefatos gerados, não apenas os logs.
6. Registre em `reports/seo-visibility/loop-log.md`:
   - número da iteração;
   - score anterior e atual;
   - mudança realizada;
   - melhora ou piora observada;
   - risco introduzido;
   - próximo passo.
7. Preserve a melhor versão. Reverta a última mudança se ela piorar claramente o score, o artefato, a privacidade, a acessibilidade ou a clareza para pessoas.

## Avaliação subjetiva

Além do score determinístico, avalie de 0 a 100:

- clareza da entidade;
- utilidade para um visitante novo;
- diferenciação factual;
- qualidade da navegação pública;
- responsabilidade das afirmações;
- prontidão para citação.

A média subjetiva deve chegar a pelo menos 90. Não aumente essa nota por otimismo; cite evidências do HTML e da interface.

## Revisões independentes

Quando disponível, solicite revisões separadas para:

1. SEO técnico e pré-renderização;
2. conteúdo, entidade e citabilidade;
3. privacidade, segurança e fronteiras públicas;
4. acessibilidade e experiência mobile.

Resolva achados relevantes e repita os checks. Não esconda divergências entre revisores.

## Regras de parada

Pare quando ocorrer a primeira condição aplicável:

- score determinístico >= 95, média subjetiva >= 90 e todos os checks passam;
- seis iterações foram concluídas;
- a próxima ação depende de deploy ou janela de indexação;
- o gargalo é autoridade externa;
- os dados externos são insuficientes ou contraditórios;
- a próxima alteração aumentaria risco de regressão ou superotimização.

## Saída obrigatória

Prepare o trabalho para revisão, sem merge automático.

Entregue:

1. hipótese testada;
2. baseline;
3. score final e melhor score;
4. log das principais iterações;
5. arquivos alterados;
6. comandos e resultados dos testes;
7. artefatos inspecionados;
8. riscos restantes;
9. o que depende de deploy e observação futura;
10. descrição pronta para um PR.

Se nenhuma mudança de código for justificável, não force uma alteração. Gere apenas o benchmark, o diagnóstico e a recomendação de distribuição, indexação ou autoridade externa.
