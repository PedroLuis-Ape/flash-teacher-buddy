---
cssclasses:
  - ape-ai-note
type: lesson
domain: testing
status: validated
date: 2026-09-13
related:
  - "[[areas/mcp-agent-api]]"
  - "[[07-TESTS]]"
  - "[[learning/LESSON-INDEX]]"
  - "[[27-CONTEXT-PACKET-E-TELEMETRIA]]"
---

# Test doubles precisam carimbar `updated_at` a cada escrita

## Tentativa

Provar, no caminho de **cards**, que o `confirmation_token` morre quando o estado do alvo muda
(o equivalente ao replay de lista já coberto em `domainTrash.test.ts`).

## Expectativa

Mintar um preview de remoção, alterar um card afetado via `update_flashcards` e confirmar com o token
antigo — esperando `confirmation_required`.

## Resultado real

O token foi **aceito** e a remoção executou. Investigação em três passos:

1. o fingerprint lê o estado do banco no momento da confirmação (`cardWrites.ts` → `cardRemovalState`);
2. o teste do diagnóstico mostrou que o fingerprint **muda** corretamente depois de um update real;
3. a causa do meu teste falhar era dupla: (a) o harness `fakeSupabase.ts` reutilizava a constante
   `NOW_ISO` em `updated_at`, então **nenhuma** escrita alterava a impressão digital; (b) remoção de
   menos de `MAX_REMOVAL_WITHOUT_CONFIRMATION` (25) cards **não é material** e não exige token algum.

## Causa

Dois pressupostos não verificados: que o double reimplementava o comportamento da coluna (não
reimplementava) e que qualquer remoção exigia confirmação (só remoções materiais exigem).

## Correção

- `fakeSupabase.ts` passou a usar um relógio monotônico (`nextWriteTimestamp()`) em `created_at`,
  `updated_at` de insert/upsert e no `updated_at` de update/upsert-existente.
- O teste novo usa um lote material (30 cards) e asserta `requires_confirmation === true` antes de
  provar a rejeição do token.

## Lição reutilizável

Um test double que não carimba `updated_at` em toda escrita **esconde** qualquer proteção baseada em
estado (fingerprint, versionamento otimista, ETag, cache por versão). Ao testar esse tipo de proteção,
primeiro prove que o double muda o estado observável — senão o verde é falso.

## Anti-pattern

Validar proteção de estado apenas contra mudança de *payload*. Mudar o payload é um caso; mudar o
*estado* do alvo é outro, e é o que o fingerprint existe para cobrir.

