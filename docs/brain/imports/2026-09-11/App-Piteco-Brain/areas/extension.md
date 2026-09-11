---
cssclasses:
  - ape-ai-note
---

# Area — Extension

## Pasta
`browser-extension/ape-pronunciation-notes/`

## Estado observado
Manifest V3.

Permissões atuais:
- contextMenus
- storage
- tts

Content script:
- `http://*/*`
- `https://*/*`

## Risco principal
O alcance amplo vem do `content_scripts.matches`.
Antes de submeter:
- confirmar necessidade do content script automático;
- considerar `activeTab` + `scripting` se o fluxo puder depender de gesto explícito;
- restringir hosts se houver hosts específicos;
- manter somente permissões realmente usadas.

## Web Store
Checklist:
- [ ] nome/branding alinhado
- [ ] descrição curta
- [ ] propósito único
- [ ] justificativa de permissões
- [ ] remote code marcado corretamente
- [ ] privacy policy pública
- [ ] icon 128×128
- [ ] screenshots
- [ ] pacote ZIP final
- [ ] teste em Chrome limpo

## Privacidade
URL preparada:
`https://www.apeeducation.org/privacy/piteco-notes.html`

Revalidar que está publicada e acessível sem login.
