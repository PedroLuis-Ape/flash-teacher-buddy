# Auditoria editorial obrigatória — 2026-07-25

## Escopo e método

Esta auditoria foi executada sobre o commit `67916d55`, depois do merge do mapa editorial mestre do PR #338. O objetivo foi verificar profundidade, propósito, originalidade, organização, confiança e presença no HTML inicial sem transformar contagem de palavras em meta artificial.

Foram inspecionados:

- as 23 definições em `config/editorial/`;
- o componente compartilhado `EditorialPage`;
- o pré-renderizador e os 23 HTMLs produzidos em `dist`;
- canonical, H1, JSON-LD, FAQ, links e relatório de visibilidade;
- o portal dinâmico e seus estados de erro;
- duplicação exata entre introduções, parágrafos e respostas de FAQ.

As contagens de “fonte” abrangem introduções, destaques, seções, itens, FAQ e links específicos da página. As contagens de “HTML” incluem também navegação, autoria compartilhada e outros textos do layout. São aproximações, não metas.

## Baseline

- Build do `main` atual: aprovado.
- Rotas editoriais pré-renderizadas: 23 de 23.
- Score determinístico: 100/100.
- H1: exatamente um em cada uma das 23 páginas.
- Canonical: correto nas 23 páginas.
- Duplicação exata entre parágrafos substanciais: nenhuma.
- Gargalo editorial: páginas localizadas curtas, sobretudo em inglês.
- Regressão factual objetiva: o portal fabricava um professor de demonstração quando a RPC pública não existia.

O score de 100/100 comprova os gates atuais, mas não comprova sozinho profundidade. O gate de conteúdo aceita uma introdução e duas seções; por isso esta auditoria usa cobertura da intenção e informação própria do produto como evidência principal.

## Hipótese desta iteração

> Observamos que o portal substituía uma falha real da RPC por um professor fictício. A causa provável é um fallback criado para evitar um diretório vazio. A menor alteração verificável é remover o perfil sintético, preservar o erro diagnosticável e manter uma única autoridade de metadados na rota. Esperamos melhorar integridade factual, confiança e citabilidade sem alterar conteúdo privado, Supabase, publicação ou layout geral.

Esta é uma correção de regressão objetiva, não uma nova hipótese de ranqueamento. A próxima ampliação editorial deve respeitar a janela externa registrada para 5 de agosto de 2026.

## Classificação consolidada

| Página | Palavras na fonte | Palavras no HTML | Classificação | Decisão neste ciclo |
|---|---:|---:|---|---|
| `/` | 1.352 | 1.457 | excessiva ou repetitiva | Não expandir; observar possível redução futura |
| `/atividades-de-ingles` | 897 | 1.000 | completa | Nenhuma alteração editorial necessária |
| `/flashcards-de-ingles` | 659 | 756 | completa | Nenhuma alteração editorial necessária |
| `/ingles-para-iniciantes` | 606 | 704 | adequada | Nenhuma alteração editorial necessária |
| `/para-professores` | 808 | 908 | completa | Nenhuma alteração editorial necessária |
| `/about` | 568 | 662 | adequada | Nenhuma alteração editorial necessária |
| `/portal` | 249 | 342 | superficial | Corrigir apenas integridade do diretório |
| `/pt-br` | 129 | 218 | superficial | Candidata futura; não alterar neste ciclo |
| `/pt-br/recursos` | 273 | 374 | superficial | Candidata futura; não alterar neste ciclo |
| `/pt-br/flashcards` | 190 | 283 | superficial | Candidata futura; não alterar neste ciclo |
| `/pt-br/para-professores` | 169 | 265 | superficial | Candidata futura; não alterar neste ciclo |
| `/pt-br/sobre` | 102 | 190 | superficial | Candidata futura; não alterar neste ciclo |
| `/pt-br/fonte-oficial` | 583 | 682 | adequada, mas incompleta para a intenção canônica | Prioridade do próximo ciclo bilíngue |
| `/pt-br/metodologia` | 803 | 1.073 | completa | Nenhuma alteração editorial necessária |
| `/pt-br/evidencias` | 695 | 965 | completa | Nenhuma alteração editorial necessária |
| `/en` | 322 | 421 | superficial | Candidata futura; não alterar neste ciclo |
| `/en/features` | 120 | 215 | superficial | Candidata futura; não alterar neste ciclo |
| `/en/flashcards` | 96 | 190 | superficial | Candidata futura; não alterar neste ciclo |
| `/en/for-teachers` | 95 | 188 | superficial | Candidata futura; não alterar neste ciclo |
| `/en/about` | 83 | 171 | superficial | Candidata futura; não alterar neste ciclo |
| `/en/official-source` | 177 | 269 | insuficiente para a intenção canônica | Prioridade do próximo ciclo bilíngue |
| `/en/methodology` | 101 | 363 | superficial | Candidata futura; não alterar neste ciclo |
| `/en/evidence` | 154 | 419 | superficial | Candidata futura; não alterar neste ciclo |

## Fichas por página

### `/`

- **Intenção principal / pergunta / público:** apresentar o produto por completo; responder o que é o APE, por que existe e para quem serve; atender alunos, professores, parceiros, imprensa, busca e IA.
- **Tese central:** uma base organizada de conteúdo pode alimentar várias formas de prática sem reduzir o produto a virar cartões.
- **Informações presentes:** identidade APE/App Piteco, problema, fluxo completo, reutilização, camadas, glossários, alunos, professores, metodologia, limites, privacidade, autoria e FAQ.
- **Informações ausentes:** nenhuma lacuna factual central foi identificada.
- **Trechos genéricos / duplicados:** não há parágrafo genérico dominante nem duplicação exata; há repetição temática de autoria, limites e prova social encontrada em páginas especializadas.
- **Informação exclusiva necessária:** a home já concentra a visão geral; não deve absorver detalhes adicionais das páginas de metodologia, evidências ou recursos.
- **Links internos:** atividades, flashcards, professores, metodologia, evidências e fonte oficial já estão presentes.
- **Necessidade / prioridade / profundidade:** nenhuma expansão; prioridade baixa; classificada como excessiva ou repetitiva por ultrapassar a faixa orientativa e repetir blocos institucionais.

### `/atividades-de-ingles`

- **Intenção principal / pergunta / público:** explicar as atividades e o que cada formato exige; responder como a mesma base vira tarefas diferentes; atender alunos e professores de inglês.
- **Tese central:** formatos diferentes exigem reconhecimento, recuperação ou produção diferentes, sem exigir reconstrução do material.
- **Informações presentes:** flashcards, escrita, múltipla escolha, ordenação, áudio, prática mista, revisão, públicos, limites e exemplos.
- **Informações ausentes:** nenhuma lacuna relevante para a intenção atual.
- **Trechos genéricos / duplicados:** texto concreto; sobreposição temática natural com metodologia, sem parágrafos copiados.
- **Informação exclusiva necessária:** comparação entre exigências das atividades já é própria desta URL.
- **Links internos:** iniciantes, flashcards, professores, metodologia e portal.
- **Necessidade / prioridade / profundidade:** NENHUMA ALTERAÇÃO EDITORIAL NECESSÁRIA; prioridade baixa; completa.

### `/flashcards-de-ingles`

- **Intenção principal / pergunta / público:** diferenciar os flashcards do APE; responder como contexto, camadas, glossário e áudio funcionam; atender estudantes e professores.
- **Tese central:** o card preserva contexto e alimenta outras atividades, em vez de permanecer isolado.
- **Informações presentes:** fluxo de estudo, palavras e frases, camadas, glossários, áudio, direção, reutilização, limites e exemplo completo.
- **Informações ausentes:** nenhuma lacuna central.
- **Trechos genéricos / duplicados:** conteúdo próprio e exemplos concretos; sobreposição esperada com a documentação técnica de cards.
- **Informação exclusiva necessária:** o exemplo editorial e a orientação de uso das camadas já diferenciam a página.
- **Links internos:** atividades, documentação de flashcards, recursos, portal e metodologia.
- **Necessidade / prioridade / profundidade:** NENHUMA ALTERAÇÃO EDITORIAL NECESSÁRIA; prioridade baixa; completa.

### `/ingles-para-iniciantes`

- **Intenção principal / pergunta / público:** orientar iniciantes sem prometer fluência; responder por onde começar e como aumentar a dificuldade; atender adolescentes e adultos falantes de português.
- **Tese central:** conteúdo pequeno, contexto claro, reconhecimento inicial, produção gradual e revisão informada por erros formam um caminho responsável.
- **Informações presentes:** ponto de partida, tamanho de listas, reconhecimento, áudio, erro, professor, expectativas e FAQ.
- **Informações ausentes:** exemplos de uma primeira lista poderiam ser úteis, mas a intenção já é respondida sem eles.
- **Trechos genéricos / duplicados:** linguagem concreta e responsável; sem duplicação exata.
- **Informação exclusiva necessária:** progressão específica para iniciantes está presente.
- **Links internos:** atividades, flashcards, portal e professores.
- **Necessidade / prioridade / profundidade:** nenhuma alteração neste ciclo; prioridade baixa; adequada.

### `/para-professores`

- **Intenção principal / pergunta / público:** demonstrar o fluxo docente real; responder como materiais são criados, importados, organizados, adaptados e publicados; atender tutores e escolas pequenas.
- **Tese central:** um professor pode reutilizar a mesma base com intenção pedagógica, preservando separação entre contextos privados e públicos.
- **Informações presentes:** material bruto, reutilização, pastas, listas, turmas, glossários, importação, publicação, acompanhamento, autoria e limites.
- **Informações ausentes:** nenhuma lacuna relevante para a intenção comercial e explicativa.
- **Trechos genéricos / duplicados:** há sobreposição com `/pt-br/para-professores`, mas esta página é narrativa e a outra pretende ser documentação.
- **Informação exclusiva necessária:** exemplos de fluxo e distinção entre glossários já aparecem.
- **Links internos:** documentação docente, recursos, metodologia, portal e sobre.
- **Necessidade / prioridade / profundidade:** NENHUMA ALTERAÇÃO EDITORIAL NECESSÁRIA; prioridade baixa; completa.

### `/about`

- **Intenção principal / pergunta / público:** explicar origem, propósito, autoria e responsabilidade; responder por que o produto existe e como evolui; atender usuários, parceiros, imprensa e mecanismos de busca.
- **Tese central:** o APE nasce da união entre prática docente e desenvolvimento tecnológico, com transparência sobre limites e privacidade.
- **Informações presentes:** problema, autoria pública abreviada, APE Education, princípios, produção institucional, evolução e privacidade.
- **Informações ausentes:** um resumo cronológico mais concreto poderia ajudar, mas não há fatos versionados suficientes para justificar cronologia adicional.
- **Trechos genéricos / duplicados:** sobreposição temática com fonte oficial, sem duplicação textual.
- **Informação exclusiva necessária:** origem e responsabilidade institucional já são próprias desta página.
- **Links internos:** fonte oficial, metodologia, evidências, professores e fonte profissional externa.
- **Necessidade / prioridade / profundidade:** nenhuma alteração neste ciclo; prioridade baixa; adequada.

### `/portal`

- **Intenção principal / pergunta / público:** explicar o diretório e orientar descoberta pública; responder o que pode aparecer e o que permanece privado; atender visitantes e professores publicadores.
- **Tese central:** o portal contém apenas perfis e materiais publicados conscientemente; não reproduz a biblioteca privada.
- **Informações presentes:** escopo público, exclusões privadas, avaliação de material, prova social, FAQ e links.
- **Informações ausentes:** funcionamento do diretório, estados de indisponibilidade e caminhos seguros quando a busca falha merecem maior explicação futura.
- **Trechos genéricos / duplicados:** algumas frases institucionais poderiam valer para qualquer portal; o cartão de autoria repete conteúdo compartilhado.
- **Informação exclusiva necessária:** política de publicação, critérios de qualidade e diferença entre acesso direto e indexação.
- **Links internos:** home, atividades, flashcards e professores.
- **Necessidade / prioridade / profundidade:** reescrita editorial futura de prioridade média; superficial. Neste ciclo foi corrigido somente o fallback fictício e removida a segunda autoridade de metadados.

### `/pt-br`

- **Intenção principal / pergunta / público:** servir como entrada localizada; responder onde encontrar documentação em português; atender o público brasileiro.
- **Tese central:** a versão portuguesa organiza caminhos para estudar, ensinar e consultar transparência.
- **Informações presentes:** três blocos curtos de navegação e links para sete páginas.
- **Informações ausentes:** definição completa, fluxo, públicos, diferenças do produto e exemplo de uso.
- **Trechos genéricos / duplicados:** os blocos “Para estudar”, “Para ensinar” e “Documentação” são corretos, mas resumidos demais.
- **Informação exclusiva necessária:** mapa de navegação comentado e distinção entre páginas educativas e documentação.
- **Links internos:** cobertura adequada das páginas portuguesas.
- **Necessidade / prioridade / profundidade:** reescrita necessária; prioridade média; superficial.

### `/pt-br/recursos`

- **Intenção principal / pergunta / público:** documentar recursos reais e sua finalidade; responder o que existe e o que não deve ser inferido; atender usuários, parceiros e IA.
- **Tese central:** recursos conectam organização, contexto, prática, turmas e publicação.
- **Informações presentes:** nove categorias, incluindo extensão e limites de inferência.
- **Informações ausentes:** problema resolvido, funcionamento, público, exemplo, relação e limite de cada categoria.
- **Trechos genéricos / duplicados:** vários blocos funcionam como catálogo de uma frase.
- **Informação exclusiva necessária:** estado real de disponibilidade, dependências de navegador e relações entre importação, listas e modos.
- **Links internos:** flashcards, professores, metodologia e fonte oficial.
- **Necessidade / prioridade / profundidade:** reescrita necessária em pequeno grupo; prioridade alta; superficial.

### `/pt-br/flashcards`

- **Intenção principal / pergunta / público:** documentar o sistema de cards em linguagem acessível; responder como dados do card se relacionam com estudo e contexto.
- **Tese central:** cards possuem direção, conteúdo adicional, camadas, glossário, áudio e reutilização.
- **Informações presentes:** seis seções corretas e links relacionados.
- **Informações ausentes:** problema, exemplo concreto, regras de camadas, limites de densidade e relação com modos.
- **Trechos genéricos / duplicados:** resumos curtos repetem temas aprofundados em `/flashcards-de-ingles`.
- **Informação exclusiva necessária:** documentação factual do modelo de card sem repetir a página educativa.
- **Links internos:** página educativa, recursos e metodologia.
- **Necessidade / prioridade / profundidade:** reescrita necessária; prioridade alta; superficial.

### `/pt-br/para-professores`

- **Intenção principal / pergunta / público:** documentar recursos docentes; responder qual é o fluxo operacional do professor.
- **Tese central:** criar ou importar, organizar, atribuir, adaptar glossário, publicar e interpretar progresso são etapas distintas.
- **Informações presentes:** sete etapas e links.
- **Informações ausentes:** detalhes de decisão, exemplos, separação por turma, limites de publicação e relação entre cada etapa.
- **Trechos genéricos / duplicados:** os títulos são informativos, mas os parágrafos permanecem próximos de resumos.
- **Informação exclusiva necessária:** documentação operacional e distinção clara da página narrativa `/para-professores`.
- **Links internos:** página narrativa, recursos, fonte oficial e portal.
- **Necessidade / prioridade / profundidade:** reescrita necessária; prioridade alta; superficial.

### `/pt-br/sobre`

- **Intenção principal / pergunta / público:** apresentar propósito, autoria e princípios em português; responder quem é responsável e quais limites orientam o projeto.
- **Tese central:** o produto combina propósito educacional, responsabilidade e privacidade.
- **Informações presentes:** quatro seções muito breves e três links.
- **Informações ausentes:** origem, problema, visão, evolução, transparência e relação entre prática docente e tecnologia.
- **Trechos genéricos / duplicados:** resumo da página `/about`, sem profundidade própria.
- **Informação exclusiva necessária:** versão localizada completa e natural, não apenas condensada.
- **Links internos:** sobre principal, fonte oficial e metodologia.
- **Necessidade / prioridade / profundidade:** reescrita necessária; prioridade alta; superficial.

### `/pt-br/fonte-oficial`

- **Intenção principal / pergunta / público:** ser a referência factual canônica; responder identidade, autoria, manutenção, propósito, público, recursos, privacidade, limites e citação.
- **Tese central:** APE e App Piteco identificam o mesmo produto educacional brasileiro, documentado por fontes públicas verificáveis.
- **Informações presentes:** identidade, descrição ampliada, recursos, autoria, prova social, metodologia, privacidade, atualização, FAQ e fontes externas.
- **Informações ausentes:** domínio oficial explicitado no corpo, recursos que não devem ser inferidos, procedimento de correção, descrição curta de citação e origem de cada classe de afirmação.
- **Trechos genéricos / duplicados:** sobreposição intencional com home e sobre; sem parágrafo exato duplicado.
- **Informação exclusiva necessária:** política de citação curta/ampliada, limites de inferência e mapa de fontes.
- **Links internos:** recursos, metodologia, evidências, sobre, Preply e GitHub.
- **Necessidade / prioridade / profundidade:** adequada como resumo, incompleta para a intenção canônica; prioridade máxima no próximo ciclo, junto com a versão inglesa.

### `/pt-br/metodologia`

- **Intenção principal / pergunta / público:** explicar a arquitetura pedagógica e seus limites; responder por que tentativa, feedback, distribuição e variação são usados.
- **Tese central:** a mesma base pode sustentar exigências cognitivas diferentes, sem criar alegação de eficácia específica do software.
- **Informações presentes:** oito seções, exemplos, onze itens, FAQ, seis referências e limite explícito.
- **Informações ausentes:** nenhuma lacuna editorial central.
- **Trechos genéricos / duplicados:** conexão temática necessária com evidências, sem duplicação exata.
- **Informação exclusiva necessária:** explicação de arquitetura pedagógica já está presente.
- **Links internos:** evidências, recursos e fonte oficial.
- **Necessidade / prioridade / profundidade:** NENHUMA ALTERAÇÃO EDITORIAL NECESSÁRIA; prioridade baixa; completa.

### `/pt-br/evidencias`

- **Intenção principal / pergunta / público:** sintetizar pesquisas e declarar limites; responder o que os estudos sustentam e o que não provam sobre o APE.
- **Tese central:** evidência geral orienta decisões de design, mas não substitui avaliação causal do produto.
- **Informações presentes:** recuperação, distribuição, transferência, sínteses, conexão com recursos, limites, agenda, FAQ e seis referências.
- **Informações ausentes:** nenhuma lacuna editorial central.
- **Trechos genéricos / duplicados:** repete princípios da metodologia apenas para estabelecer o limite de evidência.
- **Informação exclusiva necessária:** distinção entre literatura e eficácia do produto já é própria da página.
- **Links internos:** metodologia, flashcards e fonte oficial.
- **Necessidade / prioridade / profundidade:** NENHUMA ALTERAÇÃO EDITORIAL NECESSÁRIA; prioridade baixa; completa.

### `/en`

- **Intenção principal / pergunta / público:** introduzir o produto internacionalmente; responder o que é APE e onde encontrar documentação em inglês.
- **Tese central:** uma base organizada alimenta várias formas de prática para alunos e professores.
- **Informações presentes:** problema, fluxo, públicos, autoria, metodologia, limites, FAQ e links.
- **Informações ausentes:** camadas, glossários, importação, áudio, separação público/privado e exemplo concreto.
- **Trechos genéricos / duplicados:** funciona como resumo da home, sem a mesma cobertura editorial.
- **Informação exclusiva necessária:** tradução editorial natural da visão geral, adaptada ao público internacional.
- **Links internos:** cobre as oito páginas inglesas.
- **Necessidade / prioridade / profundidade:** reescrita necessária; prioridade alta; superficial.

### `/en/features`

- **Intenção principal / pergunta / público:** documentar recursos reais em inglês; responder o que o produto oferece e para que serve.
- **Tese central:** organização, cards, glossários, prática, turmas, publicação e extensão formam um sistema conectado.
- **Informações presentes:** seis categorias e sete itens.
- **Informações ausentes:** problema, funcionamento, público, exemplos, relações e limites de cada recurso.
- **Trechos genéricos / duplicados:** catálogo curto, com predominância de títulos.
- **Informação exclusiva necessária:** documentação internacional factual e limites de disponibilidade.
- **Links internos:** flashcards, professores e metodologia.
- **Necessidade / prioridade / profundidade:** reescrita necessária; prioridade alta; superficial.

### `/en/flashcards`

- **Intenção principal / pergunta / público:** explicar cards a usuários internacionais; responder como contexto e reutilização diferenciam o sistema.
- **Tese central:** cards preservam contexto e podem alimentar outras tarefas.
- **Informações presentes:** recuperação, contexto, camadas, áudio, direção e limites.
- **Informações ausentes:** exemplo, glossário, fluxo completo, relação com importação e prática mista.
- **Trechos genéricos / duplicados:** resumo muito curto da página portuguesa especializada.
- **Informação exclusiva necessária:** versão inglesa editorialmente equivalente, sem tradução mecânica.
- **Links internos:** recursos e metodologia.
- **Necessidade / prioridade / profundidade:** reescrita necessária; prioridade alta; superficial.

### `/en/for-teachers`

- **Intenção principal / pergunta / público:** explicar o fluxo docente internacional; responder como criar, organizar, usar turmas e publicar.
- **Tese central:** conteúdo reutilizável reduz reconstrução e preserva intenção.
- **Informações presentes:** cinco etapas e três links.
- **Informações ausentes:** exemplos, importação estruturada, separação de glossários, privacidade, adaptação e limites.
- **Trechos genéricos / duplicados:** resumo de títulos, inferior à cobertura portuguesa.
- **Informação exclusiva necessária:** fluxo docente completo em inglês.
- **Links internos:** recursos, sobre e fonte oficial.
- **Necessidade / prioridade / profundidade:** reescrita necessária; prioridade alta; superficial.

### `/en/about`

- **Intenção principal / pergunta / público:** explicar origem, autoria e responsabilidade internacionalmente.
- **Tese central:** propósito, criador, organização e privacidade orientam o projeto.
- **Informações presentes:** quatro seções e três links.
- **Informações ausentes:** problema original, visão, evolução, produção editorial, transparência e relação entre ensino e tecnologia.
- **Trechos genéricos / duplicados:** resumo muito curto da página `/about`.
- **Informação exclusiva necessária:** versão internacional completa e natural.
- **Links internos:** fonte oficial, metodologia e evidências.
- **Necessidade / prioridade / profundidade:** reescrita necessária; prioridade alta; superficial.

### `/en/official-source`

- **Intenção principal / pergunta / público:** fornecer fatos canônicos para busca, IA, mídia e parceiros.
- **Tese central:** APE/App Piteco é um produto educacional brasileiro com autoria e fontes públicas verificáveis.
- **Informações presentes:** identidade, snapshot profissional, recursos, privacidade, limite de evidência e uma FAQ.
- **Informações ausentes:** significado da sigla no corpo completo, propósito, público, domínio oficial, manutenção, lista abrangente de recursos, não inferências, citação curta/ampliada, revisão e mapa de fontes.
- **Trechos genéricos / duplicados:** condensação insuficiente da fonte portuguesa.
- **Informação exclusiva necessária:** referência canônica internacional completa.
- **Links internos:** recursos, metodologia e evidências.
- **Necessidade / prioridade / profundidade:** reescrita necessária; prioridade máxima no próximo ciclo bilíngue; insuficiente para sua intenção.

### `/en/methodology`

- **Intenção principal / pergunta / público:** explicar arquitetura e limites em inglês; responder por que as tarefas variam.
- **Tese central:** recuperação, feedback, distribuição e variação conectam conteúdo a prática.
- **Informações presentes:** seis seções, fontes acadêmicas renderizadas e três links.
- **Informações ausentes:** exemplos, papel de professor/aluno, contexto por camadas e glossário, limites mais desenvolvidos e FAQ.
- **Trechos genéricos / duplicados:** estrutura correta, mas resumos de uma ou duas frases.
- **Informação exclusiva necessária:** tradução editorial natural da metodologia completa.
- **Links internos:** evidências, recursos e fonte oficial.
- **Necessidade / prioridade / profundidade:** reescrita necessária; prioridade alta; superficial.

### `/en/evidence`

- **Intenção principal / pergunta / público:** sintetizar pesquisa e limites em inglês; responder o que estudos gerais permitem afirmar.
- **Tese central:** princípios gerais informam o design, mas não provam eficácia específica do APE.
- **Informações presentes:** recuperação, distribuição, transferência, relação com APE, prova social, limites, itens e referências.
- **Informações ausentes:** síntese mais completa dos estudos, limites metodológicos, agenda de avaliação e FAQ.
- **Trechos genéricos / duplicados:** correta, porém muito condensada em comparação com a versão portuguesa.
- **Informação exclusiva necessária:** versão internacional completa da fronteira de evidência.
- **Links internos:** metodologia e fonte oficial.
- **Necessidade / prioridade / profundidade:** reescrita necessária; prioridade alta; superficial.

## Conteúdo em inglês ainda sem equivalente dedicado

Não existem rotas inglesas dedicadas equivalentes a `/atividades-de-ingles`, `/ingles-para-iniciantes` e `/portal`. Isso é uma lacuna de arquitetura editorial, não autorização para criar páginas em massa. A necessidade deve ser validada no próximo ciclo antes de adicionar novas URLs, sitemap ou hreflang.

## Relatório final da iteração

| Página | Estado anterior | Lacunas | Alteração | Estado final |
|---|---|---|---|---|
| `/portal` | Superficial e factualmente insegura quando a RPC faltava | Perfil fictício mascarava falha; duas autoridades de metadados | Remoção do perfil sintético, erro específico visível, retry preservado e remoção do `SEOHead` duplicado | Continua curta, mas passa a preservar integridade factual e diagnóstico |
| Demais 22 rotas | Variam entre superficial e completa | Registradas nas fichas | Nenhuma alteração neste ciclo | Estado editorial preservado para evitar nova hipótese antes da janela |

### Antes e depois da página modificada

- **Palavras específicas antes:** aproximadamente 249.
- **Palavras específicas depois:** aproximadamente 249; não houve expansão artificial.
- **Assuntos adicionados:** nenhum assunto editorial novo.
- **Assuntos removidos:** perfil fictício e selo de demonstração do diretório.
- **Links internos adicionados:** nenhum.
- **Duplicação corrigida:** segunda instância de `SEOHead` na mesma rota.
- **Fonte factual usada:** resposta real da RPC `search_public_teachers`; na ausência dela, erro explícito.
- **Por que ficou mais útil:** visitantes deixam de confundir demonstração com perfil publicado e recebem diagnóstico recuperável.
- **Risco de prolixidade:** nenhum aumento.

## Próxima hipótese recomendada

Depois de 5 de agosto de 2026, aprofundar somente o par `/pt-br/fonte-oficial` e `/en/official-source`, usando uma matriz comum de fatos e texto editorial natural em cada idioma. O objetivo seria tornar as duas URLs referências factuais completas, sem reescrever novamente as 23 rotas.

Não iniciar essa hipótese antes da medição externa, salvo novo defeito técnico ou de privacidade comprovado.
