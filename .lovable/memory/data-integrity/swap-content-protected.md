---
name: Swap Content Function Protected
description: handleSwapSides em ListDetail é blindada por teste de contrato; usar apenas RPC swap_flashcards_sides, nunca loop client-side
type: constraint
---
A função "Inverter conteúdo" (`handleSwapSides` em `src/pages/ListDetail.tsx`) é PROTEGIDA:

- DEVE usar única chamada RPC `supabase.rpc("swap_flashcards_sides", { _list_id })`.
- NUNCA fazer loop client-side ou update card-a-card.
- NUNCA tocar em `lang_a`, `lang_b`, `labels_a`, `labels_b`, `study_type`, `tts_enabled` (responsabilidade da RPC separada `swap_list_sides`).
- Após sucesso, invalidar APENAS: `["flashcards", id]`, `["gameshub-list", id]`, `["study-flashcards", id]` + remover cópia offline.

Proteção: teste em `src/pages/__tests__/swapFlashcardsSides.contract.test.ts` (8 testes), doc em `docs/SWAP_CONTENT_PROTECTED.md`, comentário forte no código.

**Why:** Já quebrou por loops manuais (travavam mobile) e mistura com inversão de idiomas (bug "português no campo de inglês").
