# Gerenciador oficial de pacotes da Loja do App Piteco

Esta pasta é o único ponto de entrada para adicionar, substituir ou arquivar pacotes visuais da loja.

## Contrato obrigatório

Cada pacote é um único produto composto por duas artes inseparáveis:

- `card`: card vertical colecionável;
- `avatar`: foto de perfil correspondente.

Um pacote nunca pode ser publicado com apenas uma das imagens.

## Estrutura

```text
store-packages/
├── catalog.json
├── piteco_prime/
│   ├── card.avif
│   └── avatar.avif
├── piteco_vampiro/
│   ├── card.avif
│   └── avatar.avif
└── ...
```

O arquivo `catalog.json` é a fonte única de IDs, nomes, descrições, raridades, preços, versões e estado de publicação.

## Adicionar um pacote

1. Crie `store-packages/<id>/`.
2. Coloque o card e o avatar na pasta.
3. Registre o pacote em `catalog.json` com `active: false`.
4. Execute `node scripts/store-packages/validate.mjs --require-assets`.
5. Altere `active` para `true`.
6. Execute `node scripts/store-packages/sync.mjs --dry-run` para revisar.
7. Execute `node scripts/store-packages/sync.mjs` para publicar.

Também é possível usar a ação manual **Store packages** no GitHub, depois que os segredos do Supabase estiverem configurados no repositório.

## Substituir o design

Substitua as duas artes dentro da pasta e aumente `version`. Mantenha o mesmo `id`: ele é a referência usada por compras, inventários e perfis.

## Retirar da loja

Altere `active` para `false` e sincronize. O pacote fica arquivado e some da loja, mas continua disponível no inventário de quem já o comprou.

Não exclua registros do banco para retirar um pacote da venda.

## Formatos aceitos

- AVIF
- WebP
- PNG
- JPEG

Tamanho máximo: 8 MB por imagem.

## Comandos

```bash
node scripts/store-packages/validate.mjs
node scripts/store-packages/validate.mjs --require-assets
node scripts/store-packages/sync.mjs --dry-run
node scripts/store-packages/sync.mjs
node scripts/store-packages/sync.mjs --only=piteco_prime
```

A sincronização real exige as variáveis `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`. O modo de planejamento não altera o banco.

## Catálogo inicial

Os seis pacotes oficiais estão registrados como rascunho até que as doze artes finais sejam colocadas nas respectivas pastas:

- Piteco Prime — lendário — 750 PiteCOIN;
- Piteco Vampiro — épico — 500 PiteCOIN;
- Piteco Zombie — raro — 300 PiteCOIN;
- Piteco Ninja — épico — 500 PiteCOIN;
- Piteco Astronauta — épico — 500 PiteCOIN;
- Piteco Explorador — raro — 300 PiteCOIN.
