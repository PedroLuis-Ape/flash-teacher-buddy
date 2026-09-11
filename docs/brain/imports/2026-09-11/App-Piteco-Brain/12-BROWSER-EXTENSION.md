---
cssclasses:
  - ape-ai-note
---

# Browser Extension — APE Pronúncia e Notas / Piteco Notes

## Localização
**[VERIFICADO-REPO]**
`browser-extension/ape-pronunciation-notes/`

## Manifest atual
- Manifest V3
- nome: `APE Pronúncia e Notas`
- versão: `1.0.0`
- permissions: `contextMenus`, `storage`, `tts`
- service worker: `background.js`
- popup: `popup.html`
- content script: `content.js`.

## Acesso amplo
**[VERIFICADO-REPO]**
`content_scripts.matches`:
- `http://*/*`
- `https://*/*`

Isso é acesso amplo a páginas, mesmo sem `host_permissions` explícito no manifest observado.

## Revisão antes da Web Store
1. descobrir por que `content.js` precisa carregar automaticamente em todos os sites;
2. se só precisa agir após gesto do usuário, avaliar `activeTab` + `scripting`;
3. se existem hosts fixos, restringir;
4. testar texto, imagem, contexto, painel, TTS e persistência;
5. não remover permissão cegamente.

## Código remoto
**[REVALIDAR]**
Marcar “não usa código remoto” somente se JS/WASM executável estiver empacotado e não houver execução de código buscado externamente.

## Propósito único
Extensão educacional para capturar, salvar e revisar conteúdo escolhido pelo usuário, com TTS como apoio ao estudo.

## Privacy
URL preparada:
`https://www.apeeducation.org/privacy/piteco-notes.html`

Revalidar publicação real antes da submissão definitiva.

## Nomenclatura
Manifest ainda usa `APE Pronúncia e Notas`, enquanto a listagem discutida usa Piteco Notes / Salvar nas Notas. Alinhar branding antes do envio.
