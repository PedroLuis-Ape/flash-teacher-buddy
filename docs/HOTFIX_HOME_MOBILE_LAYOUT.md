# Hotfix — Home mobile no modo Galáxia

Corrige o deslocamento horizontal da Home que ocorre somente com a paleta Galáxia no Chrome Android.

Causa principal: o cometa ainda era renderizado no mobile e atravessava até `140vw`, apesar de o restante do modo já estar simplificado.

Correção:

- cometa totalmente desativado no mobile, dispositivos lentos e `prefers-reduced-motion`;
- estrelas reduzidas e estáticas no mobile;
- camada galáctica limitada ao viewport;
- braço da galáxia sem rotação que expanda a largura no mobile;
- nenhum estilo dos outros temas foi alterado.
