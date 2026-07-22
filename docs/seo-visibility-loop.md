# APE Search Visibility Experiment Loop

## Objetivo

Criar um ciclo de engenharia orientado por avaliações para melhorar a encontrabilidade e a citabilidade do APE / App Piteco sem transformar o produto em uma sequência infinita de mudanças reativas.

O sistema possui dois loops independentes:

1. **Loop técnico rápido** — executado durante uma tarefa ou PR.
2. **Loop externo lento** — executado depois que uma versão foi publicada e teve tempo para ser descoberta.

## Por que dois loops

Código, HTML, metadata, sitemap, privacidade e performance podem ser avaliados imediatamente. Resultados de busca não podem. Uma página pode levar dias ou semanas para ser rastreada, indexada e reapresentada.

Por isso, a ausência do APE em uma pesquisa imediatamente após uma alteração não autoriza outra alteração. Esse comportamento causaria superotimização, perda de identidade e mudanças sem causalidade observável.

---

## Loop técnico rápido

### Entrada

- branch isolada;
- hipótese explícita;
- estado atual do repositório;
- avaliação determinística;
- artefatos de build e pré-renderização.

### Ciclo

```text
baseline
→ classificar gargalo
→ escolher uma hipótese
→ fazer uma mudança focada
→ build e avaliações
→ inspecionar artefatos
→ revisar privacidade e regressões
→ comparar com o melhor resultado
→ continuar ou parar
```

### Gargalos classificáveis

- conteúdo principal ausente do HTML inicial;
- identidade APE / App Piteco pouco clara;
- canonical ou hreflang inconsistente;
- sitemap incompleto;
- robots ou infraestrutura bloqueando rastreadores;
- llms.txt inconsistente com páginas públicas;
- páginas públicas não pré-renderizadas;
- descoberta pública vazia ou mascarada;
- JSON-LD divergente do conteúdo visível;
- links internos insuficientes;
- conteúdo superficial ou genérico;
- problema de performance ou acessibilidade;
- privacidade comprometida;
- problema que não é técnico: indexação pendente ou baixa autoridade externa.

### Pontuação local

O comando `npm run seo:visibility:score` produz um relatório JSON de 0 a 100 com cinco áreas:

- clareza da entidade;
- profundidade editorial;
- descoberta e rastreabilidade;
- artefato pré-renderizado;
- privacidade e integridade.

### Meta

- pontuação total de pelo menos 95;
- nenhum gate crítico reprovado;
- `typecheck`, testes, lint e build aprovados;
- inspeção direta do HTML e dos relatórios;
- nenhuma regressão visual ou de privacidade.

### Limites

- máximo de 6 iterações técnicas por execução;
- uma melhoria principal por iteração;
- não fazer merge, deploy ou alteração remota;
- não mudar banco ou infraestrutura para aumentar uma pontuação artificialmente.

---

## Loop externo lento

### Entrada

- versão publicada identificada por commit;
- data do deploy;
- conjunto fixo de consultas;
- resultados do ciclo anterior;
- Search Console / Bing quando disponíveis;
- inspeção do domínio publicado.

### Janela mínima

O padrão do projeto é **14 dias** entre hipóteses de código para o mesmo grupo de consultas. Uma janela menor só é aceitável para corrigir falhas objetivas, como 404, noindex, canonical errado ou página ausente do sitemap.

### Ciclo

```text
publicar versão aprovada
→ registrar commit e data
→ enviar sitemap/URLs pelos canais disponíveis
→ aguardar janela de observação
→ repetir o benchmark fixo
→ comparar com o ciclo anterior
→ classificar o gargalo
→ criar no máximo uma nova hipótese
→ abrir PR ou registrar que nenhuma mudança de código é justificável
```

### O que medir

Para cada consulta:

- mecanismo ou assistente;
- consulta literal;
- marca mencionada;
- domínio citado;
- URL citada;
- descrição correta;
- confusão com outra entidade;
- posição aproximada quando observável;
- data e commit implantado.

### Resultados possíveis

- **não rastreado** — corrigir acesso técnico;
- **rastreado, não indexado** — investigar qualidade, duplicidade, canonical e sinais externos;
- **indexado por marca, ausente por categoria** — relevância temática ou autoridade;
- **entidade confundida** — reforçar desambiguação consistente;
- **aparece sem citação** — melhorar fonte, autoria, clareza e autoridade;
- **nenhum problema técnico** — investir em distribuição, conteúdo útil e backlinks legítimos;
- **dados insuficientes** — manter versão e observar, sem editar.

---

## Benchmark fixo

As consultas oficiais estão em `config/seo-visibility-queries.json`. Não troque todas as consultas a cada ciclo. Novas consultas podem ser adicionadas, mas as consultas históricas devem permanecer para permitir comparação.

## Registro dos ciclos

Salvar os artefatos em:

```text
reports/seo-visibility/
├── latest-eval.json
├── codex-last-message.md
└── benchmarks/
    └── YYYY-MM-DD.json
```

Cada benchmark deve informar:

- commit implantado;
- ambiente;
- data;
- consultas;
- resultados;
- hipótese anterior;
- conclusão;
- próxima ação recomendada.

## Regras de segurança

- nenhum acesso de escrita em produção;
- nenhum merge automático;
- nenhuma publicação automática;
- nenhuma migration remota;
- nenhum dado privado em relatório;
- nenhuma pesquisa deve usar nomes, URLs ou IDs privados;
- não criar texto oculto, keyword stuffing ou páginas em massa;
- não comprar ou fabricar backlinks;
- não atribuir causalidade a uma mudança quando a janela de observação não permite.

## Como executar

### Avaliação local

```bash
npm run build
npm run seo:visibility:score
```

### Preparar o loop do Codex

```bash
npm run seo:codex-loop
```

O comando acima apenas mostra as instruções e valida o ambiente. Para iniciar uma execução autônoma em uma branch limpa:

```bash
npm run seo:codex-loop -- --execute
```

O Codex deve ter acesso à internet habilitado quando a tarefa incluir pesquisa externa. O acesso deve permanecer restrito e a tarefa não deve receber credenciais administrativas.

## Definition of Done de um ciclo técnico

Um ciclo termina quando:

- o score local é pelo menos 95;
- todos os checks obrigatórios passam;
- o artefato foi inspecionado;
- a hipótese e o resultado estão registrados;
- os riscos restantes estão explícitos;
- foi aberto um PR para revisão, sem merge automático.

## Definition of Done do programa

O programa não tem um estado final absoluto de “SEO resolvido”. Ele entra em manutenção quando:

- páginas prioritárias estão publicadas, rastreáveis e indexadas;
- a marca aparece de forma consistente em consultas de entidade;
- a descrição da entidade é correta;
- consultas de categoria começam a gerar impressões e referências;
- a principal limitação passa a ser autoridade externa, e não falha técnica;
- a medição quinzenal pode ser reduzida para mensal.
