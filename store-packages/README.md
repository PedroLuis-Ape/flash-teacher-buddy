# Pacotes oficiais da Loja do App Piteco

Esta pasta é o único caminho para adicionar, substituir ou arquivar pacotes da loja.

Cada pacote é um produto único composto por:

- `card.avif`
- `avatar.avif`

A estrutura padrão é:

```text
store-packages/
├── catalog.json
├── nome_do_pacote/
│   ├── card.avif
│   └── avatar.avif
```

O ID do pacote deve permanecer estável depois da publicação. Para remover um pacote da loja, marque-o como inativo no catálogo. Isso preserva compras e inventários existentes.

Comandos:

```bash
npm run store:validate
npm run store:sync
```

A sincronização deve publicar as imagens no bucket `piteco-store` e atualizar `skins_catalog` e `public_catalog`.
