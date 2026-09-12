---
cssclasses:
  - ape-ai-note
type: area
domain: browser-extension
status: active
priority: medium
last_reviewed: 2026-09-13
related:
  - "[[00-HOME]]"
  - "[[01-CURRENT-STATE]]"
  - "[[03-ARCHITECTURE]]"
  - "[[08-RISKS]]"
  - "[[10-CONTEXT-FEEDING-RULE]]"
  - "[[24-SECURITY-AUDIT-2026-09-12]]"
---

# Área — Extensão oficial de navegador (APE Pronúncia e Notas)

## Estado atual (2026-09-13)

- A extensão **existe e está em desenvolvimento**; o código vive em
  `browser-extension/ape-pronunciation-notes/` (Manifest V3).
- Recursos: sistema de notas, captura de conteúdo, painel e TTS com preset de
  **inglês americano (en-US)**.
- Integração planejada: transformar notas em flashcards compatíveis com o App
  Piteco via Super Import.
- Preparada para a Chrome Web Store, porém **NÃO aprovada e NÃO publicada**.
- [DECISION] Nenhuma superfície do produto pode afirmar disponibilidade, exibir
  botão funcional de instalação ou usar URL de loja enquanto o estado não for
  `published`.

Contexto histórico das notas importadas:
`imports/2026-09-11/App-Piteco-Brain/12-BROWSER-EXTENSION.md` e
`imports/2026-09-11/App-Piteco-Brain/areas/extension.md` (checklist de submissão
e riscos de permissão).

## Fonte única de verdade

`public/extensao/store-config.json` — lida pela página pública de status e, pelo
app, por `src/features/browser-extension/browserExtensionIntegration.ts`.
Nenhum componente pode ter URL de loja própria.

```json
{ "platform": "chrome", "status": "pending_review",
  "chrome": "", "edge": "", "version": null, "approvedAt": null }
```

## Máquina de estados

`development → pending_review → approved → published → temporarily_unavailable`

- Só `published` libera CTA público — e **apenas** com URL `https` do domínio
  oficial (`chromewebstore.google.com` / `chrome.google.com` /
  `microsoftedge.microsoft.com`).
- `approved` NÃO libera: aprovação é pré-condição, não disponibilidade.
- A existência de uma URL, sozinha, nunca é tratada como verdade.
- `resolveBrowserExtensionCta()` é o único caminho autorizado a devolver um CTA;
  qualquer falha de leitura degrada para `pending_review`.

## Ponto de integração escolhido

- **Escolha:** aba **Ferramentas no Perfil** (área autenticada), reaproveitando o
  padrão de abas já existente em Perfil (Aparência, Histórico, Inventário…).
- **Opcional no futuro:** card discreto na Home apontando para a mesma
  superfície — nunca dois CTAs competindo com o CTA de estudo.
- **Descartados por ora:** Biblioteca e importação (a extensão é ferramenta de
  conta, não de uma lista específica); página dedicada “Ferramentas APE” só se
  houver mais de uma ferramenta.
- Enquanto não publicada: **nenhum CTA**. A página pública
  `/extensao/index.html` existe como status honesto e está com `noindex,follow`.

## Fluxo futuro

APE → aluno descobre a ferramenta → *Adicionar extensão* → loja oficial →
instalar → usar (notas + TTS) → *Criar flashcards com IA* → pacote compatível
com **Super Import** → lista/cards/glossário no APE → estudar.

Reutiliza os contratos existentes (Super Import, schema oficial, glossário,
`word_hints`, layered cards). **Não criar formato paralelo de flashcard.**

## Checklist de ativação (quando o Google aprovar)

1. confirmar aprovação na Chrome Web Store;
2. copiar a URL oficial;
3. testar instalação pública em Chrome limpo;
4. registrar a versão aprovada;
5. preencher `chrome` (e `edge`, se houver) em
   `public/extensao/store-config.json`;
6. trocar `status` para `published` e preencher `version`/`approvedAt`;
7. trocar `noindex,follow` por `index,follow` na página de status;
8. criar a UX final na aba Ferramentas (usando `resolveBrowserExtensionCta`);
9. conferir que a página explica que a extensão é para navegadores de desktop;
10. validar analytics do CTA quando a medição first-party do programa de
    ativação pública estiver ativa;
11. rodar os gates (typecheck, testes, lint, build, SEO, brain:check);
12. publicar pelo processo normal do APE.

## Riscos e pendências herdadas

- [REVALIDATE] Permissões amplas de content script (`http://*/*`, `https://*/*`)
  precisam de justificativa ou redução antes da submissão — ver notas importadas.
- [REVALIDATE] Política de privacidade em
  `https://www.apeeducation.org/privacy/piteco-notes.html` precisa estar no ar
  sem login antes do envio.
- [REVALIDATE] Branding divergente entre manifest (`APE Pronúncia e Notas`) e a
  listagem discutida (Piteco Notes) — alinhar antes do envio.
- [DECISION] Nada de ZIP/CRX como fluxo principal: o APE é ponto de descoberta,
  a instalação acontece na loja oficial.

Related: [[01-CURRENT-STATE]] · [[08-RISKS]] · [[10-CONTEXT-FEEDING-RULE]] · [[24-SECURITY-AUDIT-2026-09-12]]

