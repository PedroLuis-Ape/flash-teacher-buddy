---
category: documentation
cssclasses:
  - ape-ai-note
type: protocol
status: active
area: knowledge-management
last_reviewed: 2026-09-16
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

Política canônica: `C:\Users\pedro\.codex\policies\second-brain-policy.md`.
Este protocolo é uma otimização de **reuso de contexto**, não um preflight obrigatório.

## Quando usar

O Context Packet só deve ser criado quando as duas condições forem verdadeiras:

1. a tarefa realmente precisou recuperar memória/histórico; e
2. o mesmo contexto recuperado será reutilizado por **dois ou mais atores/etapas**.

Se a MAIN resolve a tarefa sozinha, mesmo após uma leitura seletiva do Brain, não há obrigação de
criar packet. Em tarefa simples/local normalmente não há leitura, packet ou telemetria de memória.

## Problema que o protocolo resolve

Em cadeias com múltiplos atores, cada etapa costumava refazer preflight e reler as mesmas notas.
O objetivo é pagar o custo de retrieval uma vez e compartilhar um resumo verificável, sem transformar
o próprio protocolo em custo fixo de toda tarefa.

## READ ONCE → COMPACT → SHARE → REUSE

Quando houver reutilização real:

1. **READ ONCE** — a MAIN recupera somente notas/trechos capazes de mudar a decisão.
2. **COMPACT** — cria um packet curto com objetivo, regras, contratos, decisões, riscos, arquivos,
   invariantes, incertezas e ponteiros `sha256`; o packet não copia o vault.
3. **SHARE** — entrega o mesmo packet aos atores/etapas que precisam dele.
4. **REUSE** — quem recebeu packet válido não refaz preflight nem relê Brain/PRs por precaução.

Lacuna material = recuperar uma nota/trecho e fazer patch do packet. Não reconstruir o contexto inteiro.

## Artefatos

| Artefato | Caminho | Papel |
| --- | --- | --- |
| Manifesto | `docs/brain/brain-manifest.json` | Índice derivado de notas; consultar por filtro, nunca despejar integralmente no contexto. |
| Context Packet | `.superpowers/sdd/context-packets/<task>.packet.json` | Resumo compartilhável da tarefa quando há reuso real. |
| Ledger | `.superpowers/sdd/brain-telemetry.jsonl` | Telemetria de tarefas que efetivamente usaram o protocolo. |

Packet e ledger são artefatos de execução, não memória canônica.

## Comandos

```bash
node scripts/brain-index.mjs
node scripts/brain-index.mjs --check
node scripts/brain-index.mjs --compare <dir>

node scripts/context-packet.mjs new --task <id> --objective "<texto>" --domain <dominio>
node scripts/context-packet.mjs show --packet <arquivo> --actor worker
node scripts/context-packet.mjs validate --packet <arquivo> [--record]
node scripts/context-packet.mjs read --packet <arquivo> --note-path <nota>
node scripts/context-packet.mjs patch --packet <arquivo> --append CAMPO=valor --reason "<motivo>"

node scripts/brain-telemetry.mjs report [--task <id>] [--format md|json]
```

Esses comandos são ferramentas disponíveis, não checklist obrigatório. Não gerar packet/ledger só para
registrar que a tarefa não usou memória.

## Campos do packet

`PROJECT`, `OBJECTIVE`, `BRAIN_VERSION`, `RELEVANT_RULES`,
`RELEVANT_ARCHITECTURE`, `CONTRACTS`, `DECISIONS`, `KNOWN_RISKS`,
`FILES_MODULES`, `DO_NOT_BREAK`, `OPEN_UNCERTAINTIES`.

Detalhes permanecem na nota-fonte referenciada. Se faltar um fato material, recuperar somente a fonte
necessária em vez de expandir o packet preventivamente.

## Invalidação

Invalidar ou rebasear somente por mudança material:

- objetivo/escopo mudou;
- nota referenciada mudou (`REF_CHANGED`) ou sumiu (`REF_MISSING`);
- contrato, decisão ou risco referenciado mudou;
- domínio material da tarefa mudou.

`DRIFT` em nota não referenciada não obriga reconstrução. Não invalidar por tempo decorrido nem por
“reler para ter certeza”.

## Papéis

- **MAIN** — decide se memória é necessária e, só se houver reuso previsto, cria/compartilha o packet.
- **WORKER** — trabalha a partir do objetivo + arquivos/trechos + packet/resumo recebido; não refaz preflight.
- **REVIEWER** — recebe objetivo, diff, testes, evidências, riscos e contexto compacto; só busca fonte extra
  se faltar informação material.
- **CORREÇÃO / SEGUNDA REVISÃO** — reutilizam o mesmo packet patchado quando o packet existe.

Não existe obrigação de abrir Brain, Worker ou Reviewer em toda tarefa, nem cadeia fixa entre esses papéis.

## Telemetria

Contadores disponíveis: `brain_reads`, `brain_files_read`, `brain_tokens_loaded`,
`context_packet_tokens`, `context_reuse_count`, `context_patch_count`,
`context_invalidations` e `invalidation_reason`.

Estimativa declarada: `tokens = ceil(bytes / 4)`. É proxy comparável de bytes carregados, não contagem
real de tokenizer. Para avaliar economia, compare antes/depois no mesmo tipo de tarefa e registre também
número de agentes, esforço de raciocínio, leituras, packets e gates repetidos.

## Evidência histórica medida — 2026-09-13

Na tarefa P1 “Ponto de atenção não materializa Reforço no preview”, uma cadeia
MAIN → WORKER → REVIEWER → CORREÇÃO → REVIEWER com preflight repetido teve 5 leituras, 50 arquivos e
~122.045 tokens estimados. Com contexto reutilizado, a medição caiu para ~35.003 tokens no cenário
conservador e ~18.163 no cenário enxuto, sem perder os 7 fatos materiais avaliados.

Essa medição demonstra o valor de **reuso quando há cadeia multiagente**; ela não justifica criar
cadeia, packet ou telemetria em tarefas que não precisam deles.

## Limites

- Packet não substitui código, Git, banco ou testes.
- `brain_version` global pode mudar por nota irrelevante; por isso drift global não bloqueia reuso.
- Vault externo e `docs/brain/` devem ser reconciliados quando houver mudança material, sem criar memória paralela.
- A melhor otimização continua sendo **não carregar contexto que não pode mudar a decisão**.

## Related

[[10-CONTEXT-FEEDING-RULE]] · [[00-HOME]] · [[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]] ·
[[01-CURRENT-STATE]] · [[04-DECISIONS]] · [[07-TESTS]] · [[08-RISKS]] · [[06-BUGS]]
