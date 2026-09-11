---
cssclasses:
  - ape-ai-note
type: canonical-vault
status: active
area: knowledge-management
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[22-OBSIDIAN-KNOWLEDGE-GRAPH-PROTOCOL]]"
  - "[[learning/00-LEARNING-HUB]]"
  - "[[areas/adaptive-learning]]"
---

# Segundo Cérebro canônico do App Piteco

Este é o vault operacional versionado do App Piteco. A cópia em
`docs/brain/` foi migrada de `C:\Users\pedro\Documents\App-Piteco-Brain` em
2026-09-11, preservando Properties/YAML, wikilinks, `.obsidian`, áreas,
sessões e o histórico importado.

## Fonte de verdade

- Git e o código atual são a fonte de verdade da implementação.
- Este vault é a fonte de verdade de contexto operacional, decisões,
  relações, riscos, evidências e handoff.
- A pasta externa `C:\Users\pedro\Documents\App-Piteco-Brain` fica como
  ponte histórica congelada após esta migração; não manter duas memórias
  ativas nem escrever seletivamente em ambas.
- A aparência e a classe `ape-ai-note` continuam preservadas para manter as
  anotações do agente em vermelho no Obsidian.

## Skills obrigatórias

- `C:\Users\pedro\.codex\skills\piteco-second-brain-protocol\SKILL.md`
- `C:\Users\pedro\.codex\skills\piteco-adaptive-learning-loop\SKILL.md`

O fluxo começa em [[00-HOME]], passa pelo preflight de [[01-CURRENT-STATE]],
recupera aprendizagem relevante em [[learning/00-LEARNING-HUB]] e encerra
com evidência, atualização de memória e handoff conectado.

## Manutenção

Use `npm run brain:check` antes de encerrar uma tarefa significativa. O
checker verifica notas nucleares, frontmatter, wikilinks ativos, IDs
canônicos, placeholders e a existência de um log de sessão. O material em
`imports/` permanece histórico e não é reescrito para satisfazer uma
validação da memória ativa.
