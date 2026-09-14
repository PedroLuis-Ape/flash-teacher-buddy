---
category: agent
area: mcp
cssclasses:
  - ape-ai-note
type: area
domain: mcp
status: active
priority: high
last_reviewed: 2026-09-13
related:
  - "[[areas/mcp-agent-api]]"
  - "[[01-CURRENT-STATE]]"
  - "[[04-DECISIONS]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
  - "[[10-CONTEXT-FEEDING-RULE]]"
  - "[[areas/adaptive-learning]]"
  - "[[sessions/2026-09-13-mcp-vocabulary]]"
---

# Analise de texto -> vocabulario realmente novo (MCP)

## Objetivo

Responder a pergunta central do caso de uso do agente: dado um texto, o que
este aluno REALMENTE nao tem ainda na propria biblioteca?

O motor vive em `src/lib/mcp/learning/` e alimenta a tool
`analyze_text_against_library`. Ele **apenas analisa**: nada cria, edita ou
apaga cards. Criacao e outro fluxo, com confirmacao explicita do usuario.

Ver [[areas/mcp-agent-api]] para a camada de dominio/tools que este motor
reutiliza.

## Comportamento esperado

- O texto entra pelo agente; a parte pesada (indice da biblioteca) roda no
  servidor. O LLM recebe apenas os candidatos que aparecem no texto.
- Cada candidato sai classificado, com evidencia (card casado, sentidos
  existentes, sentenca de contexto) e motivo legivel.
- A resposta tem as chaves de contrato: `analyzed_language`, `candidates`,
  `already_known`, `new_vocabulary`, `ambiguous`, `summary`.
- Ambiguidade nunca e resolvida em silencio: vira `AMBIGUOUS` ou
  `POSSIBLE_DUPLICATE` para o agente perguntar.

## Modelo conceitual

Pipeline deterministico, sem rede no nucleo:

TEXTO -> normalizacao -> deteccao de idioma -> inventario da biblioteca ->
expressoes conhecidas -> expressoes provaveis -> palavras isoladas ->
mesclagem/classificacao -> resposta

Classificacao interna por candidato:

| Status | Quando acontece |
| --- | --- |
| IGNORE_BASIC | Artigo/particula/preposicao muito basica do idioma (padrao), fora de expressao |
| KNOWN_EXACT | Mesma forma normalizada de um card |
| KNOWN_VARIANT | Variante de acento, ortografia (color/colour), contracao (don't/do not) ou hifen |
| KNOWN_LEMMA | Flexao: plural, tempo verbal, irregular (studies/study, ran/run, casas/casa) |
| KNOWN_EXPRESSION | Card multi-palavra casado como unidade (phrasal verb, MWE) |
| POSSIBLE_DUPLICATE | Mesma forma com sentidos diferentes, termo contido em expressao conhecida ou erro de digitacao proximo |
| NEW | Sem correspondencia: vocabulario genuinamente novo |
| AMBIGUOUS | Palavra conhecida usada so dentro de expressao nova, ou idioma sem confianca |

## Decisao central: expressao nao colapsa

`look`, `look for`, `look after` e `look up to` tem chaves exatas
distintas e sao comparadas como sequencia inteira de tokens. Consequencias
deliberadas:

- `text.contains(card.term)` esta proibido por desenho: o casamento e por
  token/janela, com a maior janela ganhando.
- Se a biblioteca tem `look` e o texto tem `look for` (expressao nova),
  `look for` sai como NEW e `look` sai como AMBIGUOUS com
  `word_only_inside_expression` — nunca como "ja conhecido".
- Se a biblioteca tem as duas, `look after` e casado como
  KNOWN_EXPRESSION e `look` nao vira candidato solto.
- Artigos, particulas e preposicoes basicas sao ignorados por padrao, mas a
  expressao que as contem continua sendo analisada (`get over`, `run into`,
  `look after`); `look at` e `go to` estao na lista de combinacoes
  sintaticas basicas justamente para nao virar "vocabulario novo".
- Descoberta de expressao nova exige particula forte (up/out/over/into...) ou
  lista curada de phrasal verbs comuns; a lista curada evita falsos positivos
  como "bank of" e "invoice arrived for".

## Decisao central: duplicata nao e so termo repetido

- `bank` com dois sentidos cadastrados (banco financeiro e margem do rio)
  nao e declarado conhecido: sai como POSSIBLE_DUPLICATE
  (`existing_senses_differ`) com os sentidos e exemplos existentes.
- Palavra que so existe dentro de uma expressao conhecida (`look` quando ha
  `look after`) sai como POSSIBLE_DUPLICATE (`term_contained_in_known_expression`).
- Erro de digitacao proximo de um termo (`recieve` x `receive`) sai como
  POSSIBLE_DUPLICATE (`near_miss:receive`), nao como NEW e nunca como
  conhecido. Palavras curtas nao entram nesse corte: `word` x `work` segue NEW.
- Sentido diferente com termo diferente (big/large) NAO e detectavel sem
  recurso semantico: ver "Limites" e "Evolucao futura".

## Arquitetura e escala

`build_vocabulary_inventory()` nao faz N consultas por lista:

1. uma contagem agregada de listas do escopo;
2. uma contagem agregada de cards (`head + count`);
3. paginas de 1000 cards ordenadas por `(created_at, id)`.

O numero de requests cresce com cards/pagina, nunca com o numero de listas.
Medido: 1000 listas com 12.000 cards -> **14 requests** (2 contagens + 12
paginas), 254 ms, com o mesmo custo de uma biblioteca de 50 listas/12.000 cards.
Teto de seguranca: 40 paginas (40.000 cards); acima disso o resultado marca
`truncated` e a analise cobre apenas o que foi lido.

O inventario e um indice em memoria com `version` e `fingerprint` de
conteudo (FNV-1a sobre card id + chave + assinatura de significado).

## Cache e invalidacao

- Cache em memoria por `userId|escopo|idioma|filtros`, TTL de 60 s, teto de 8
  entradas. Sem `cacheKey` (dono/escopo) **nao ha cache**: evita vazar
  inventario entre contas.
- CONTRATO: todo fluxo de escrita (criar/editar/apagar card) precisa chamar
  `invalidateVocabularyInventory(userId|escopo)` antes da proxima analise.
- Enquanto o cache estiver quente, uma analise imediatamente posterior a uma
  criacao pode devolver o inventario antigo. O resultado expoe
  `summary.library.from_cache` e `fingerprint` para tornar isso visivel.

## Dados e integracao

- A tool monta o client com `createUserScopedDb(ctx)` (token verificado) e
  valida o escopo com `assertScopeAccessible`.
- A varredura usa a projecao de card do dominio (`CARD_SELECT`), os helpers
  de leitura (`asRows`/`asRow`/`str`/`truncatedStr`), o escopo do dominio e
  a traducao de erro do dominio. Nada de SQL proprio e nada de service role.
- Filtros aninhados seguem o mesmo formato ja usado em `domain/search.ts`
  (`flashcards -> lists!inner -> folders!inner`), estreitando por
  `user_id`, `system_kind = user`, `deleted_at is null`, `class_id is null`
  e escopo pessoal/institucional.
- A base da chave exata e compativel com
  `public.normalize_term_for_check()` (o checker de duplicatas do app): o
  motor e um superconjunto dele.
- [FOLLOW-UP DE ARQUITETURA] A varredura de biblioteca inteira nao existe no
  `domain/flashcards.ts` (que exige `list_id` e limita a 100). O ideal e
  promove-la para o dominio e deixar `learning/supabaseSource.ts` apenas
  adaptando. Feito assim por escopo de escrita desta rodada.

## Contratos que nao podem quebrar

1. A tool nunca escreve (read-only e idempotente); criacao e outro fluxo.
2. Nenhuma tool aceita identidade do modelo: o escopo vem do token.
3. `look` / `look for` / `look after` / `look up to` continuam sendo
   quatro chaves distintas.
4. Palavra funcional basica so e descartada com confianca alta de idioma; com
   confianca baixa ela vira AMBIGUOUS.
5. Mesma biblioteca + mesmo texto -> mesmo resultado (fingerprint, contagens e
   ordem dos candidatos).
6. O payload nao carrega a biblioteca: so os itens que aparecem no texto.
7. Nenhuma promocao a "conhecido" por semelhanca: proximidade gera
   POSSIBLE_DUPLICATE.

## Limites e riscos

- [RISCO] Lematizacao e heuristica (dicionario curto + regras). Falso lema so
  entra como KNOWN_LEMMA e sempre existe a forma exata como primeiro criterio.
- [RISCO] Descoberta de expressao nova pode gerar candidato a mais; o agente
  sempre pergunta antes de criar, e o volume de expressoes novas e limitado.
- [RISCO] Ambiguidade de idioma em textos muito curtos reduz a classificacao a
  AMBIGUOUS para palavras funcionais (comportamento deliberado, nao bug).
- [LIMITE] Semantica (big/large, sinônimos, sentido no texto) nao e detectada
  sem recurso vetorial: ver "Evolucao futura".
- [LIMITE] Cache quente pode atrasar a percepcao de uma criacao ate a
  invalidacao (contrato acima).

## Evolucao futura (nao implementado)

Um passo futuro e combinar o inventario lexical com embeddings (por exemplo,
vetor da traducao/definicao e do sentido do termo no texto) para detectar
duplicata semantica entre termos diferentes — hoje nao ha stack vetorial no
projeto e o requisito explicito e nao adicionar uma nesta rodada. O desenho
atual ja separa a camada de decisao (status por candidato) do acesso a dados,
entao o acoplamento futuro fica em um unico ponto.

## Testes que protegem

Em `src/lib/mcp/__tests__/learning/` (28 testes, 6 arquivos):

- TEST F: conhecidos x novos x funcionais basicos x flexoes, incluindo
  `look`/ `look for`/ `look after`/ `look at`.
- TEST G: sentidos diferentes do mesmo termo, expressao que contem termo
  conhecido, erro de digitacao e o contraexemplo `word` x `work`.
- TEST H: depois de "criar" (fixture alterada + invalidacao), as palavras
  deixam de ser novas; o comportamento sem invalidacao tambem esta travado.
- TEST I: 1000 listas / 12.000 cards com teto de requests, 12 paginas,
  zero consulta por lista, tempo e determinismo.
- Normalizacao: casefold, pontuacao, contracoes nos dois sentidos,
  ortografia, acentos, plural/lema, distancia de edicao e deteccao de idioma.
- Boundary da tool: schema, ausencia de campo de identidade, erro sem
  autenticacao, escopo institucional sem id, filtros por pasta/lista.

Ver [[07-TESTS]].

## Status

- [VERIFIED-TEST] Motor, inventario, tool e testes implementados em nivel
  unitario (28 testes novos; suite do MCP 18 arquivos / 117 testes verdes).
- [VERIFIED-STATIC] `tsc` do app sem erro nos arquivos deste motor;
  `eslint src/lib/mcp` exit 0.
- [NAO VERIFICADO] Nenhuma chamada real ao Supabase/MCP com dado de usuario.
- [PENDENTE DE INTEGRACAO] Registro da tool em `src/lib/mcp/index.ts` e
  inclusao do nome nas listas de teste de superficie (arquivo de outro dono).

## Proximo passo

Integrar o registro da tool (snippet em
`.superpowers/sdd/mcp-vocabulary-report.md`), rodar smoke autenticado real
com um texto de exemplo e, so depois, ligar o fluxo criar cards chamando
`invalidateVocabularyInventory`.
