---
cssclasses:
  - ape-ai-note
---

# Area — Rewrite

## Estado
**[VERIFICADO-REPO] Implementado no HEAD observado.**  
**[REVALIDAR] QA visual autenticado.**

## Máquina
LISTENING → REVIEW → REWRITE → COMPLETED.

## LISTENING
- alvo não deve aparecer/renderizar legível;
- lado oposto visível;
- TTS ilimitado;
- hint progressivo;
- glossário do alvo indisponível.

## Submit
- primeiro acerto → completed;
- primeiro erro → review + hadInitialError.

## REVIEW/REWRITE
- revelar correto/diff;
- áudio permanece;
- iniciar reescrita explicitamente;
- erro continua;
- acerto conclui.

## Snapshot
Scope de sessão/card/contexto é propagado por Study/Mixed.

## QA prioritário
- 360/390/412
- teclado
- Enter/double click
- TTS repetido
- refresh LISTENING
- refresh REWRITE
- Mixed
- voltar/pular
- glossário ausente em LISTENING.
