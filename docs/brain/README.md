---
cssclasses:
  - ape-ai-note
type: canonical-vault
status: active
area: knowledge-management
related:
  - "[[00-HOME]]"
  - "[[10-CONTEXT-FEEDING-RULE]]"
  - "[[01-CURRENT-STATE]]"
  - "[[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]]"
  - "[[learning/00-LEARNING-HUB]]"
  - "[[areas/adaptive-learning]]"
---

# Segundo Cérebro do App Piteco

Este é o espelho versionado e sincronizado do App Piteco. A entrada operacional
oficial do Obsidian fica em
`C:\Users\pedro\Documents\App-Piteco-Brain`. A cópia em
`docs/brain/` foi migrada de `C:\Users\pedro\Documents\App-Piteco-Brain` em
2026-09-11, preservando Properties/YAML, wikilinks, `.obsidian`, áreas,
sessões e o histórico importado.

## Fonte de verdade

- Git e o código atual são a fonte de verdade da implementação.
- O vault externo é a entrada operacional oficial do Obsidian para contexto,
  decisões, relações, riscos, evidências e handoff.
- Esta cópia em `docs/brain/` é a versão reconciliada e versionada no Git;
  mudanças materiais devem ser reconciliadas com o vault externo oficial, sem
  criar duas explicações concorrentes.
- A aparência e a classe `ape-ai-note` continuam preservadas para manter as
  anotações do agente em vermelho no Obsidian.

## Skills obrigatórias

- `C:\Users\pedro\.codex\skills\piteco-second-brain-protocol\SKILL.md`
- `C:\Users\pedro\.codex\skills\piteco-adaptive-learning-loop\SKILL.md`

O fluxo começa em [[10-CONTEXT-FEEDING-RULE|START HERE — Protocolo de contexto]],
passa por [[00-HOME]] e pelo preflight de [[01-CURRENT-STATE]],
recupera aprendizagem relevante em [[learning/00-LEARNING-HUB]] e encerra
com evidência, atualização de memória e handoff conectado.

## Manutenção

Use `npm run brain:check` antes de encerrar uma tarefa significativa. O
checker verifica notas nucleares, frontmatter, wikilinks ativos, IDs
canônicos, placeholders e a existência de um log de sessão. O material em
`imports/` permanece histórico e não é reescrito para satisfazer uma
validação da memória ativa.
