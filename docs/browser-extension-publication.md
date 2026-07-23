# Publicação da extensão APE Pronúncia e Notas

A extensão está em `browser-extension/ape-pronunciation-notes`.

## Fluxo

1. Abra o workflow **Browser Extension Package** no GitHub Actions.
2. Baixe o artefato `ape-pronunciation-notes-store-package`.
3. Envie o ZIP à Chrome Web Store.
4. Opcionalmente, envie o mesmo pacote ao Microsoft Edge Add-ons.
5. Depois da aprovação, preencha as URLs em `public/extensao/store-config.json`.

A página pública `/extensao/index.html` detecta Chrome, Edge e dispositivos móveis. Quando a URL da loja estiver configurada, o botão passa a abrir diretamente a página oficial de instalação.

Sites não podem instalar extensões silenciosamente; o navegador sempre exige confirmação final do usuário.
