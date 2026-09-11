---
cssclasses:
  - ape-ai-note
---

# Obsidian Maintenance Protocol

## Propósito
Evitar perda de contexto em execução longa.

## Antes de tarefa
1. [[01-CURRENT-STATE]]
2. nota da área
3. [[16-DECISIONS]]
4. riscos/bugs
5. commits recentes.

## Depois
Atualizar:
- área;
- bugs;
- testes;
- commit/branch;
- risco;
- handoff.

Supervisor atualiza:
- CURRENT STATE;
- Current Workstream;
- Astra Handoff.

## Checkpoint
Criar ao:
- terminar onda;
- trocar agente;
- resolver P0/P1;
- mudar arquitetura;
- interromper;
- encerrar sessão.

## Compactação
CURRENT STATE é curto e atual. Histórico vai para áreas/sessions/evolution.

## Regra anti-falsa-memória
“Já corrigido” exige evidência:
commit + teste/código + runtime quando relevante.
Sem evidência → `REVALIDAR` ou `DESCONHECIDO`.

## Fonte de verdade
Obsidian guarda contexto; Git guarda implementação/histórico.
