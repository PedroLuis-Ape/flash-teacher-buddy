---
cssclasses:
  - ape-ai-note
type: session
date: 2026-09-13
agent: clara-principal
area: mcp
related:
  - "[[areas/mcp-vocabulary-analysis]]"
  - "[[areas/mcp-agent-api]]"
  - "[[01-CURRENT-STATE]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
---

# Sessao - Motor linguistico de analise de texto do MCP (2026-09-13)

## Objetivo

Implementar o caso de uso central do MCP do Piteco: "texto -> vocabulario
realmente novo", com normalizacao linguistica de verdade (casefold, pontuacao,
contracoes, plural/singular, flexao/lema, variantes ortograficas, palavra
isolada x expressao, phrasal verbs e MWE) e escala aceitavel.

## Estado de partida

- [FATO CONFIRMADO] Worktree
  `C:\Users\pedro\Documents\App-Piteco-Worktrees\ape-discovery-activation-20260913`,
  branch `integration/ape-program-20260913`, sem commit, merge ou publicacao.
- [FATO CONFIRMADO] Existiam apenas dominio (FASE 1) e tools read-only
  (FASE 2). A analise de texto era explicitamente "fase futura" em
  [[areas/mcp-agent-api]].
- [FATO CONFIRMADO] Nao existia nenhum motor linguistico no repositorio: os
  helpers existentes (`folderGlossaryIdentity`, `normalizeTermForAccountCheck`,
  `public.normalize_term_for_check`) fazem apenas identidade de superficie.
- [FATO CONFIRMADO] Outro worker trabalha no mesmo worktree na FASE 3
  (escrita), incluindo `domain/*Write*.ts`, tools de escrita e
  `src/lib/mcp/index.ts`.

## Trabalho executado

- `src/lib/mcp/learning/`: tipos/contratos, normalizacao, lematizacao,
  conhecimento por idioma, inventario com indice/fingerprint/cache, fonte
  Supabase reutilizando o dominio e o motor de analise.
- `src/lib/mcp/tools/analyzeText.ts`: tool read-only
  `analyze_text_against_library` (entrada com `text`, `language?`,
  `scope?`, `folder_ids?`, `list_ids?`, `ignore_basic_function_words?`).
- `src/lib/mcp/__tests__/learning/`: 6 arquivos / 28 testes (F, G, H, I,
  normalizacao e boundary da tool) com fonte de dados em memoria.
- Relatorio tecnico em `.superpowers/sdd/mcp-vocabulary-report.md`
  (inclui o snippet de registro para o integrador).

## Decisoes

- [DECISAO VIGENTE] Expressao e unidade: nada de `text.contains(card.term)`;
  casamento por janela de tokens com a maior janela ganhando.
- [DECISAO VIGENTE] Tres niveis de evidencia (exato -> variante -> lema), com o
  nivel sempre exposto no status e no motivo.
- [DECISAO VIGENTE] Palavra funcional basica ignorada por padrao, mas
  expressoes que a contem continuam analisadas; idioma sem confianca transforma
  essas palavras em AMBIGUOUS em vez de descarta-las.
- [DECISAO VIGENTE] Duplicata considera traducao/contexto/exemplo: mesma forma
  com sentidos distintos, termo contido em expressao conhecida e erro de
  digitacao proximo vao para POSSIBLE_DUPLICATE, nunca para "conhecido".
- [DECISAO VIGENTE] Sem cache sem `cacheKey` de dono/escopo; toda escrita deve
  invalidar por contrato.
- [DECISAO VIGENTE] Nada de embeddings nesta rodada (requisito explicito);
  evolucao documentada em [[areas/mcp-vocabulary-analysis]].
- [PENDENTE DE PROMOCAO] O registro formal de decisao em [[04-DECISIONS]] e a
  promocao da licao em `learning/` ficam com o supervisor/Brain: o escopo de
  escrita desta sessao cobria apenas a nota de area e esta sessao.

## Evidencia

- [VERIFIED-TEST] `vitest run src/lib/mcp/__tests__/learning`: 6 arquivos /
  28 testes PASS.
- [VERIFIED-TEST] `vitest run src/lib/mcp`: 18 arquivos / 117 testes PASS
  (baseline da rodada: 8 arquivos / 51 testes; o restante e do outro worker).
- [VERIFIED-TEST] TEST I medido: 1000 listas, 12.000 cards -> 14 requests,
  12 paginas, 254 ms, fingerprint `v1-en-a6778b20-36356284-12000`; custo
  identico com 50 listas; resultado deterministico entre execucoes.
- [VERIFIED-GATE] `eslint src/lib/mcp` exit 0.
- [VERIFIED-GATE] `tsc -p tsconfig.app.json`: nenhum erro nos arquivos deste
  motor. Restam 2 erros em arquivos do outro worker
  (`__tests__/toolsReadOnly.test.ts:118` e `__tests__/toolsWrite.test.ts:39`,
  `ContentBlock.text`), fora do escopo desta sessao.
- [NAO VERIFICADO] Nenhuma chamada real ao Supabase/MCP; sem credencial de
  usuario no harness.

## Descobertas

- [FATO CONFIRMADO] A primeira versao gastava ~4 s para indexar 12.000 cards:
  renormalizacao dos 35 pares ortograficos a cada token/entrada. Pre-normalizar
  os pares derrubou o teste de escala de ~12,7 s para 727 ms.
- [FATO CONFIRMADO] O produto ja tem um checker de duplicatas por identidade
  fraca (`normalize_term_for_check`); o motor agora e um superconjunto
  compativel dele.
- [FATO CONFIRMADO] Sem ancora de lema para a propria forma do card, "studies"
  nao casava com "study" mesmo com regra correta de plural: o indice de lema
  precisa registrar a forma exata do card tambem.
- [FATO CONFIRMADO] Regra generica de "verbo + preposicao" inventava expressao
  ("invoice arrived for"): descoberta de expressao exige particula forte ou
  lista curada.

## Riscos e limites

- Lematizacao heuristica (sem POS tagger) — falsos lemas ficam restritos a
  KNOWN_LEMMA e a forma exata tem precedencia.
- Duplicata semantica entre termos diferentes (big/large) nao e detectavel sem
  recurso vetorial.
- Cache quente entre criar e analisar exige invalidacao por contrato.
- Integracao pendente: registrar a tool em `src/lib/mcp/index.ts` (arquivo de
  outro dono) e incluir o nome na lista de tools read-only dos testes de
  superficie.

## Proximo passo

1. Integrador aplica o snippet de registro e atualiza a lista de tools
   read-only nos testes de superficie.
2. Os 2 erros de typecheck do outro worker precisam ser resolvidos por quem
   edita aqueles arquivos (nao foram tocados aqui).
3. Smoke autenticado real: `initialize -> tools/list -> analyze_text_against_library`
   com um texto curto e uma biblioteca real.
4. So depois: ligar o fluxo de criacao chamando `invalidateVocabularyInventory`.

## Classificacao

REVIEW_RECOMMENDED — implementacao e testes verdes em nivel unitario; falta
revisao independente e smoke real.

ADAPTIVE LEARNING
Prior lessons used: licoes de [[areas/mcp-agent-api]] (identidade sempre do
token; nao duplicar acesso a Supabase; envelope de erro controlado) e o padrao
de teste com fake PostgREST ja estabelecido em [[07-TESTS]].
Prediction error: eu esperava que o gargalo do TEST I fosse a varredura paginada;
o gargalo real era normalizacao repetida por token (SURPRISE: MEDIUM).
Root cause: renormalizacao dos pares ortograficos dentro de
`orthographicVariants` a cada entrada/token; e ausencia de ancora de lema para
a forma exata do card.
New lesson: em indices lexicais, pre-computar a normalizacao do dicionario uma
vez por processo e indexar a propria forma como ancora de lema; medir escala com
um teto de requests antes de otimizar o resto.
Lesson status: CANDIDATE_LESSON (uma ocorrencia, validada por teste
deterministico de escala).
Anti-pattern/playbook update: candidato a anti-pattern "normalizar dicionario
dentro do loop por item"; promocao em `learning/` depende do supervisor
(escopo de escrita desta sessao nao incluia `docs/brain/learning/`).
Future plan changed by this learning: qualquer novo indice no MCP deve medir
requests e tempo com biblioteca grande antes de ser considerado pronto.

SECOND BRAIN
Preflight: `01-CURRENT-STATE`, `areas/mcp-agent-api`, `07-TESTS` lidos e
comparados com o codigo atual.
Area notes reviewed: [[areas/mcp-agent-api]], [[areas/adaptive-learning]].
Session log: esta nota.
Relations linked: [[areas/mcp-vocabulary-analysis]],
[[areas/mcp-agent-api]], [[areas/adaptive-learning]], [[07-TESTS]],
[[08-RISKS]].
Current State: NAO editado por escopo (mudanca material pequena; fica para o
supervisor junto da integracao da tool).
Memory consistent with code: sim para o motor; integracao pendente declarada.
