---
cssclasses:
  - ape-ai-note
type: protocol
status: active
area: knowledge-management
last_reviewed: 2026-09-13
related:
  - "[[00-HOME]]"
  - "[[10-CONTEXT-FEEDING-RULE]]"
  - "[[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]]"
  - "[[01-CURRENT-STATE]]"
  - "[[04-DECISIONS]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
---

# Context Packet e telemetria de contexto

Nota canônica do protocolo de custo de contexto do App Piteco:
**READ ONCE -> COMPACT -> SHARE -> REUSE**. Ela complementa
[[10-CONTEXT-FEEDING-RULE]] (rota de entrada) e
[[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]] (conexões do grafo).

## Problema que esta nota resolve

Cada agente da cadeia (main, worker, reviewer, correção) refazia o preflight
completo e relia as mesmas notas do Segundo Cérebro na MESMA tarefa. O custo de
contexto crescia com o número de etapas, sem ganho de qualidade, e decisões já
recuperadas eram reconstruídas em vez de reutilizadas.

## Protocolo

1. **READ ONCE** - o Segundo Cérebro é lido uma vez por tarefa, no início, pelo
   caminho mais estreito disponível (manifesto + notas do domínio).
2. **COMPACT** - o resultado vira um CONTEXT PACKET compacto: objetivo, regras,
   contratos, decisões, riscos, arquivos, invariantes e incertezas, mais
   PONTEIROS com `sha256` para as notas relevantes. O packet não copia o vault.
3. **SHARE** - o MESMO packet é entregue a worker, reviewer e correção, com o
   mesmo `brain_version` e `packet_hash`.
4. **REUSE** - quem já recebeu um packet válido não refaz o preflight completo:
   presume o packet válido até evidência contrária.

## Artefatos

| Artefato | Caminho | Papel |
| --- | --- | --- |
| Manifesto | `docs/brain/brain-manifest.json` | Metadados por nota: domínio, documento canônico, descrição de 1 linha, type, last_reviewed, bytes, sha256 e `brain_version`. Gerado por `scripts/brain-index.mjs`. |
| Context Packet | `.superpowers/sdd/context-packets/<task>.packet.json` | Artefato compartilhável da tarefa, com os 11 campos e hash próprio. |
| Ledger | `.superpowers/sdd/brain-telemetry.jsonl` | Registro append-only do custo de contexto por tarefa e etapa. |

Os dois últimos são artefatos por execução (não são memória canônica) e ficam
fora do vault. O manifesto é versionado junto de `docs/brain/`.

## Comandos

```bash
node scripts/brain-index.mjs                  # regenera docs/brain/brain-manifest.json
node scripts/brain-index.mjs --check          # falha se o manifesto estiver desatualizado
node scripts/brain-index.mjs --compare <dir>  # reconcilia vault externo x docs/brain

node scripts/context-packet.mjs new --task <id> --objective "<texto>" --domain <dominio>
node scripts/context-packet.mjs show --packet <arquivo> --actor worker
node scripts/context-packet.mjs validate --packet <arquivo> [--record]
node scripts/context-packet.mjs read --packet <arquivo> --note-path <nota>
node scripts/context-packet.mjs patch --packet <arquivo> --append CAMPO=valor --reason "<motivo>"

node scripts/brain-telemetry.mjs report [--task <id>] [--format md|json]
```

## Campos do packet

`PROJECT`, `OBJECTIVE`, `BRAIN_VERSION`, `RELEVANT_RULES`,
`RELEVANT_ARCHITECTURE`, `CONTRACTS`, `DECISIONS`, `KNOWN_RISKS`,
`FILES_MODULES`, `DO_NOT_BREAK`, `OPEN_UNCERTAINTIES`.

O packet carrega decisões e invariantes em texto curto; o detalhe continua na
nota-fonte, referenciada por caminho + `sha256`. Ler o packet NÃO substitui a
fonte quando a tarefa exige o texto integral: nesse caso, retrieval de UMA nota.

## Invalidação

Invalidar/atualizar o packet SOMENTE por mudança material:

- objetivo da tarefa mudou;
- alguma nota referenciada pelo packet mudou (`REF_CHANGED`) ou sumiu
  (`REF_MISSING`);
- contrato, decisão ou risco referenciado mudou;
- domínio/área da tarefa mudou.

`validate` distingue dois casos: **DRIFT** (o `brain_version` global avançou,
mas nenhuma nota do packet mudou - reutilizar, sem rebase) e **STALE** (mudança
material em nota referenciada - patch + `--rebase`). Nunca invalidar por tempo
decorrido, por ansiedade ou por "reler para ter certeza".

## Retrieval sob demanda

Lacuna material identificada durante a execução:

1. ler UMA nota (`context-packet read --note-path <nota>`), que já registra o
   evento na telemetria;
2. **PATCH** do packet (`context-packet patch --reason "<motivo>"`) para que o
   próximo agente não repita a leitura;
3. continuar a execução - nunca reconstruir o packet inteiro.

## Papéis

- **MAIN** lê uma vez, cria e compartilha o packet, decide invalidação e
  consolida o conhecimento durável no fim.
- **WORKER** executa a partir do packet; não refaz preflight; lacuna pontual =
  uma nota + patch.
- **REVIEWER** recebe objetivo, regras relevantes, diff, testes, evidências e
  riscos pelo packet e NÃO relê o vault inteiro; revisa o que o packet aponta e
  busca UMA nota quando o fato material não estiver coberto.
- **CORREÇÃO / SEGUNDA REVISÃO** continuam do mesmo packet patchado, sem
  reconstruir contexto.

## Telemetria e estimativa de tokens

Contadores do ledger: `brain_reads`, `brain_files_read`, `brain_tokens_loaded`,
`context_packet_tokens`, `context_reuse_count`, `context_patch_count`,
`context_invalidations` e `invalidation_reason` (além de detecções de stale e
drift).

**Estimativa declarada:** `tokens = ceil(bytes / 4)`. É uma estimativa, não uma
contagem de tokenizer; o que se compara antes x depois é o mesmo estimador
aplicado a bytes reais medidos no disco.

## Evidência medida - 2026-09-13

Tarefa real medida: P1 "Ponto de atenção não materializa Reforço no preview"
([[06-BUGS]]), cadeia MAIN -> WORKER -> REVIEWER -> CORREÇÃO -> REVIEWER, com
preflight de 10 notas por etapa.

[VERIFIED-RUNTIME] Antes: 5 leituras, 50 arquivos, 488.180 B, ~122.045 tokens
estimados. Depois (conservador, com uma leitura completa do MAIN): 2 leituras
(1 leitura única + 1 retrieval sob demanda de uma nota), 11 arquivos,
~35.003 tokens estimados - redução de 71,3%, com 6 reúsos do packet e 2 patches.
Depois (enxuto, MAIN lê apenas o núcleo material): 2 leituras, 4 arquivos,
~18.163 tokens estimados - redução de 85,1%.

Medição executada com `brain_version` `6c7fcf90` (97 notas); o ledger e o
harness ficam em `.superpowers/sdd/` e são reproduzíveis.

Qualidade: os 7 fatos materiais da tarefa continuaram presentes no material
entregue à revisão (nenhuma regressão). A contagem vem do ledger JSONL gerado
pela execução real das ferramentas, não de estimativa manual.

## Limites conhecidos

- O `brain_version` é global: qualquer nota nova muda o hash. Por isso
  `validate` trata drift global como não bloqueante e só marca STALE quando uma
  nota referenciada muda.
- O packet não substitui código, Git, banco ou testes: essas continuam sendo as
  fontes de verdade da implementação.
- O vault externo e `docs/brain/` ainda apresentam divergências de redação
  anteriores a esta nota; a reconciliação é decisão da Clara Principal e não
  deve ser feita em silêncio.

## Related

[[10-CONTEXT-FEEDING-RULE]] · [[00-HOME]] · [[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]] ·
[[01-CURRENT-STATE]] · [[04-DECISIONS]] · [[07-TESTS]] · [[08-RISKS]] · [[06-BUGS]]
