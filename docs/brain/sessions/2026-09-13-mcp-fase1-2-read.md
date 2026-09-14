---
category: agent
area: study
status: active
cssclasses:
  - ape-ai-note
---

# MCP Piteco — FASE 1 + FASE 2 (read-only) — 2026-09-13

## Estado e fonte da verdade

- [FATO CONFIRMADO] Worktree: C:\Users\pedro\Documents\App-Piteco-Worktrees\ape-discovery-activation-20260913.
- [FATO CONFIRMADO] Branch integration/ape-program-20260913, sem troca de branch, sem commit, sem merge e sem publicacao.
- [FATO CONFIRMADO] Fonte de verdade da implementacao: src/lib/mcp/; supabase/functions/mcp/index.ts e auto-gerado.

## Objetivo

Criar a camada de dominio fina e reutilizavel do MCP (FASE 1) e as tools
read-only (FASE 2), com GATE_READ provado por testes, sem escrita e sem tocar
no bundle gerado a mao.

## Trabalho executado

- Dominio src/lib/mcp/domain/: erros controlados, client scoped ao token,
  paginacao e sanitizacao, escopo pessoal/institucional, pastas, listas,
  cards, perfil e busca.
- Tools get_my_profile, list_folders, list_lists, get_list, get_flashcards e
  search_my_content registradas em src/lib/mcp/index.ts (versao 0.2.0) com
  Zod estrito e annotations read-only/idempotentes.
- Testes em src/lib/mcp/__tests__/ com fake PostgREST, fixtures A/B e mock de
  @supabase/supabase-js para exercitar o caminho tool -> dominio -> client.
- Mapa de instituicoes revalidado: instituicoes sao owner-only e membership
  pertence a turma, nao a instituicao.

## Decisoes

- [DECISAO VIGENTE] Identidade sempre do token; nenhuma tool aceita user_id.
- [DECISAO VIGENTE] Toda listagem/busca estreita por owner_id = auth.uid(),
  system_kind = user, deleted_at is null, class_id is null e escopo
  institucional (institution_id is null no pessoal), mesmo quando a RLS
  permitiria mais.
- [DECISAO VIGENTE] A FASE 2 expoe apenas o escopo pessoal; o escopo
  institucional vive no dominio com um unico ponto de evolucao.
- [DECISAO VIGENTE] Respostas em envelope unico e sempre paginadas; erros
  traduzidos para codigos estaveis, sem mensagem crua do banco.

## Evidencia

- [VERIFIED-TEST] RED inicial: typecheck falhou (TS2307 no import de
  platformRuntime); apos correcao, typecheck exit 0. Em seguida 49/51 testes
  — dois testes corrigidos (JSON circular do client Supabase e limite de
  tamanho da descricao do echo). GREEN: 8 arquivos / 51 testes PASS.
- [VERIFIED-GATE] tsc app e node exit 0; eslint src/lib/mcp exit 0;
  npm run build exit 0 com SEO 100/100; brain-check BRAIN_CHECK_PASS.
- [NAO VERIFICADO] Nenhuma chamada real ao Supabase/MCP; nao ha credencial de
  usuario nem harness MCP no repo.

## Descobertas e riscos

- [FATO CONFIRMADO] O build local no Windows regenera
  supabase/functions/mcp/index.ts com npm:C:... (invalido para Deno). O
  arquivo commitado foi restaurado e o achado ficou em [[08-RISKS]].
- [FATO CONFIRMADO] pnpm neste ambiente tenta reinstalar node_modules e
  aborta; tsc, vitest e eslint locais foram usados direto de node_modules/.bin.
- [LIMITACAO] A prova de isolamento entre contas e de dominio (filtros) via
  fake de RLS; a RLS real nao foi exercitada nesta rodada.

## Handoff

Proximo movimento seguro: smoke autenticado real (initialize -> tools/list ->
get_my_profile -> list_folders -> list_lists -> get_flashcards) e, so depois,
a FASE 3 (create/update) com idempotencia e confirmacao para destrutivos.
Area: [[areas/mcp-agent-api]]. Relatorio detalhado em
.superpowers/sdd/mcp-phase1-2-report.md.
