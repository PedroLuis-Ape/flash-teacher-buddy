---
category: agent
cssclasses:
  - ape-ai-note
type: protocol-registry
area: agents
status: active
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[04-DECISIONS]]"
  - "[[05-AGENTS]]"
  - "[[10-CONTEXT-FEEDING-RULE]]"
---

# CCL — Clara Compact Language (registry do projeto)

Protocolo interno de comunicação compacta entre as Claras e agentes especializados. Fonte canônica
global: `C:\Users\pedro\.codex\ccl\` (spec JSON + spec humana + `tools/ccl.py`). Este registro é do App Piteco.

## Bootstrap
- CCL_VERSION: `CL1`
- CCL_REGISTRY_VERSION_OR_HASH: `r4ceadf`
- CCL_SPEC_POINTER: `C:\Users\pedro\.codex\ccl\spec\ccl-v1.json` (máquina) · `...\spec\ccl-v1.md` (humano)
- PROJECT_REGISTRY_POINTER: `docs/brain/registry/ccl-registry.json`

Regra de acesso: se a execução atual já conhece a mesma versão/hash, não releia a spec. ID desconhecido
→ `EXP`; nunca adivinhar. `rv` divergente → L2 recusado (NACK) e fallback L1/L0.

## Registry
30 refs ativas: `A1`, `C1`–`C7`, `D1`–`D7`, `E1`–`E2`, `N1`–`N2`, `P1`–`P2`, `Q1`, `R1`–`R6`, `S1`, `T1`.
IDs são **imutáveis**; ao aposentar, o ID vai para `tombstones` e **nunca** é reutilizado.

## Contratos operacionais
- Dono do protocolo/registry/`EXP`: **Clara Memória**. Dono do fluxo/anti-loop: **Clara Principal**.
- Handoffs internos saem em **L1**; **L2** só com versão `CL1` e `rv` iguais; **L0** para crítica, nuance e humano.
- Domínios críticos (auth, security, produção, exclusão de dados, migrations, RLS/permissões, contratos
  críticos): **L1/L0 + refs**.
- No máximo **1 rodada** de reparo de expansão; depois `ESC`/`BLOCKED`. Sem ping-pong.
- Checkpoint não encerra o projeto: checkpoint → compactar/reconciliar → continuar.

## Ferramentas
`python tools/ccl.py validate|expand|roundtrip|hash-registry|bench` (em `C:\Users\pedro\.codex\ccl`).

## Evidência
`[VERIFIED-REPO]` Registry criado em 2026-09-13 com refs extraídas das notas canônicas [[04-DECISIONS]],
[[03-ARCHITECTURE]], [[08-RISKS]] e [[07-TESTS]]. Testes de interpretação: roundtrip 12/12, `EXP` para ref
desconhecida e `NACK`/`BAD_RV` para L2 com hash divergente.

