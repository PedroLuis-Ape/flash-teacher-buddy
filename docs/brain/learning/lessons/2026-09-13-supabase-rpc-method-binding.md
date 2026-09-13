---
cssclasses:
  - ape-ai-note
type: lesson
status: candidate
area: supabase-runtime
last_reviewed: 2026-09-13
related:
  - "[[areas/supabase-runtime]]"
  - "[[sessions/2026-09-13-public-catalog-task-2]]"
  - "[[learning/LESSON-INDEX]]"
---

# Preservar o receiver ao tipar métodos do cliente Supabase

## CANDIDATE_LESSON

Extrair `publicSupabase.rpc` para uma variável e chamá-la como função removeu o
receiver interno. O browser falhou antes da rede ao ler `rest` de `undefined`.

Quando uma assinatura ainda não existe nos tipos gerados, preservar o receiver
com `publicSupabase.rpc.bind(publicSupabase)` antes do cast. Um cast de tipo não
preserva semântica de chamada.

## Evidência

- RED focado reproduziu a ausência do binding.
- Playwright reproduziu a falha em runtime.
- O mesmo contrato passou e a RPC real respondeu após o binding.

## Escopo

Aplica-se a métodos de SDK que usam estado interno em `this`. Não implica que
toda função importada precise de `bind`, nem substitui regenerar tipos Supabase.

Status: `CANDIDATE_LESSON`, validação única nesta arquitetura.

Related: [[areas/supabase-runtime]] · [[sessions/2026-09-13-public-catalog-task-2]]
