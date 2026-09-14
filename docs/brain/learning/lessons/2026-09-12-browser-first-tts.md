---
category: game
cssclasses:
  - ape-ai-note
type: lesson
id: LESSON-001
status: validated
area: browser-extension
last_validated: 2026-09-12
related:
  - "[[learning/LESSON-INDEX]]"
  - "[[areas/browser-extension]]"
  - "[[07-TESTS]]"
  - "[[08-RISKS]]"
---

# LESSON-001 — Voz do navegador primeiro, voz do sistema como fallback

## Contexto

A extensão Salvar nas Notas usava `chrome.tts` como motor principal. No
Windows, isso selecionava vozes SAPI antigas, percebidas como robóticas.

## Abordagem corrigida

Usar `speechSynthesis` do Chromium como motor principal e selecionar, por
padrão, vozes naturais ou online. Se a lista de vozes estiver vazia ou a API
falhar, usar `chrome.tts` como fallback local.

O fluxo só deve considerar a voz do navegador disponível quando houver ao
menos uma voz utilizável. Uma lista vazia não é sucesso.

## Evidência

- `tools/test-browser-tts.cjs` cobre seleção natural/local, eventos, erro e
  ausência de `speechSynthesis`.
- No Playwright, o painel informou `Voz do navegador` quando a API ofereceu
  vozes e caiu para `Voz do sistema` quando a lista estava vazia.
- O mini pop-up passou pelo fallback sem travar ou manter a barra aberta.

## Escopo

Aplica-se a extensões Chrome/Edge que precisam de TTS mais natural em painel,
conteúdo e menu de contexto.

Não implica que `speechSynthesis` sempre terá vozes: ambientes headless, perfis
sem vozes ou navegadores restritos precisam do fallback.

## Status

`VALIDATED_LESSON`

Related: [[areas/browser-extension]] · [[07-TESTS]] · [[08-RISKS]]
