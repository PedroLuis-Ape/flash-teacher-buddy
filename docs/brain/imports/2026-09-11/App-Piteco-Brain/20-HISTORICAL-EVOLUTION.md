---
cssclasses:
  - ape-ai-note
---

# Historical Evolution

> Reconstrução de marcos importantes, não de cada commit.

## 2025-10 — fundação Supabase/auth
**[HISTÓRICO]**
O projeto ainda consolidava Supabase e autenticação.
Contratos discutidos:
- mudanças incrementais sem destruir design;
- session persistence/refresh;
- evitar usuário duplicado;
- erro de rede/CORS visível;
- conteúdo organizado em folders → lists → flashcards.

## 2026-06 — estabilidade e identidade
**[HISTÓRICO]**
Auditoria profunda mapeou boot, Safe Mode, favoritos/vermelho/especial, offline e merge/unmerge. O problema de identidade grupo/camada/entrada jogável tornou-se contrato central.

## 18/06/2026 — Super Importador v1
**[HISTÓRICO]**
PR #45: contrato, schema, preview, limites, rollback/idempotência, compatibilidade e CI.

## 19/06/2026 — glossário em camadas
**[HISTÓRICO/COMMIT]**
PR #58:
- overlapping layers;
- import/export lossless;
- popover multi-layer;
- dedup;
- responsividade de ferramentas.

## Julho/2026 — glossário e SEO amadurecem
**[HISTÓRICO]**
- exact coverage/semantic review/Unicode;
- palavra+expressão;
- discussão de glossário isolado por turma;
- SEO/GEO passa a separar capacidade técnica de descoberta externa.

## 08/09/2026 — resume + importer harmony
**[VERIFICADO-REPO]**
Commit de restore de requested session sem empty queue e auditoria de importadores.

## 09/09/2026 — persistência autônoma
**[VERIFICADO-REPO]**
`fix(study): make session persistence autonomous`.
Auditoria funcional fortalece outbox, conflitos, partial failure, navegação e preview gates.

## 10/09/2026 — semântica contextual
**[VERIFICADO-REPO]**
`wip(glossary): preserve contextual hints and semantic evidence`.

## 10–11/09/2026 — Rewrite auditivo
**[VERIFICADO-REPO]**
HEAD observado implementa:
LISTENING → REVIEW → REWRITE → COMPLETED.

## Evolução geral
O projeto saiu de “flashcards + auth” para uma plataforma com:
- identidade de conteúdo/camadas;
- sessões resilientes;
- turmas e público/privado;
- importação ampla;
- glossário contextual;
- SEO citável;
- gamificação;
- extensão de navegador.

Quanto maior o produto, mais importante manter contratos e memória externa.
