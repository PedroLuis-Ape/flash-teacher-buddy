---
category: ui
area: public-landing
type: session
status: implemented-awaiting-ci
priority: medium
last_reviewed: 2026-09-16
related:
  - "[[areas/motion-system]]"
  - "[[areas/visual-polish]]"
  - "[[25-PUBLIC-ACTIVATION-PROGRAM]]"
---

# Landing pública — motion profissional (2026-09-16)

## Decisão

O usuário pediu explicitamente motion mais complexo e profissional, com foco na landing pública. A tentativa inicial via Lovable foi bloqueada por falta de créditos do workspace. A implementação foi então feita diretamente em branch GitHub isolada, preservando o contrato de dados, rotas, SEO e acessibilidade.

Nesta fatia **não foi adicionada uma biblioteca externa de animação**. A landing usa a arquitetura já existente do Motion System — CSS, `requestAnimationFrame`, `IntersectionObserver` e o hook `usePointerTilt` — mas com uma camada específica de orquestração pública em `src/features/public-home/LandingMotion.tsx`. Isso evita impacto de dependência/bundle enquanto entrega scroll progressivo, pointer light, magnetic CTA, 3D tilt e story transitions.

## Implementado

- Hero com entrada coreografada por camadas e saída sutil vinculada ao scroll.
- Ambiente visual reativo ao ponteiro em desktop/fine pointer, desativado em mobile/reduced motion.
- Flashcard demo com perspectiva 3D, tilt máximo de 4 graus, glint e reveal nativo via `<details>` preservado.
- CTA principal com movimento magnético limitado e press feedback.
- `Como funciona` virou uma composição de storytelling com visual sticky no desktop e sequência vertical no mobile; nenhum wheel/touch é interceptado.
- Featured resource, carrossel, cards de público, confiança, FAQ e CTA final recebem progressive in-view reveals.
- FAQ ganhou indicador visual rotativo sem remover semântica nativa de `<details>/<summary>`.
- Reduced motion neutraliza tilt, parallax, sticky visual e transições complexas.

## Guardrails preservados

- Nenhuma mudança em Supabase, Auth, RLS, progresso, estudo, score, importadores ou flashcards.
- H1, audience, intro, demo copy e demais fontes editoriais continuam vindo dos objetos existentes; nenhum texto SEO foi duplicado para animação.
- Conteúdo não depende de JavaScript para ficar visível: os reveals só passam a ocultar elementos depois que `IntersectionObserver` foi anexado.
- Scroll listeners são passivos e só atualizam CSS vars em `requestAnimationFrame`; não existe `preventDefault`, wheel handler ou touchmove handler.
- Motion pesado é desativado para `pointer: coarse`, mobile e `prefers-reduced-motion`.

## Arquivos principais

- `src/components/landing/LandingHome.tsx`
- `src/features/public-home/LandingMotion.tsx`
- `src/styles/landing-home.css`
- `src/features/public-home/landingProfessionalMotion.contract.test.ts`

## Validação

O branch contém um contrato focado que protege semântica, reduced motion, ausência de scroll hijacking, tilt limitado e o storytelling de três etapas. A validação completa depende do CI/preview porque o ambiente local desta sessão não possui acesso de rede para clonar/instalar o repositório.
