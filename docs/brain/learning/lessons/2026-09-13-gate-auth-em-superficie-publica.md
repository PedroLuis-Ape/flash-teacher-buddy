---
category: game
cssclasses:
  - ape-ai-note
type: lesson
status: candidate
area: browser-extension
last_reviewed: 2026-09-13
related:
  - "[[areas/browser-extension]]"
  - "[[06-BUGS]]"
  - "[[learning/LESSON-INDEX]]"
  - "[[sessions/2026-09-13-convite-extensao-landing-publica]]"
---

# Não montar convite de aquisição apenas no shell autenticado

## CANDIDATE_LESSON

Um componente de aquisição/instalação que só é montado no shell autenticado
nunca aparece para visitante — mesmo quando a regra de produto diz que a
superfície pública é elegível. Pior: o gate de autenticação costuma ficar
duplicado (montagem + condição interna), então remover só um dos dois não
resolve.

## Evidência

O convite da extensão existia desde 2026-09-13 e nunca apareceu em `/`:
`GlobalLayout` só renderiza `PrivateShell` em rota protegida autenticada, e
`/` é público; além disso o próprio componente exigia a prop `authenticated`
e só então disparava o ping da extensão.

## Como aplicar

- Separar "onde pode existir" (superfície) de "se deve aparecer" (elegibilidade);
- ter UM ponto de montagem para superfícies mutuamente exclusivas, em vez de um
  por shell;
- transformar a regra em função pura testável e cobrir a matriz de gates;
- teste de contrato que conta pontos de montagem impede a reintrodução.

## Escopo

Vale para qualquer superfície pública de aquisição (landing, página de
material, convite de extensão). Não vale para conteúdo que depende de sessão
autenticada por natureza (dados do usuário, economia, turmas).

## Ligação

[[areas/browser-extension]] · [[06-BUGS]] · [[learning/LESSON-INDEX]] ·
[[sessions/2026-09-13-convite-extensao-landing-publica]]

