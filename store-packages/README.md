# Gerenciador oficial de pacotes da Loja do App Piteco

Este diretório é a fonte canônica dos pacotes visuais publicados na loja.

## Regra estrutural

Cada pacote é um único produto inseparável, composto obrigatoriamente por:

- `card.png` ou `card.avif`: card colecionável vertical;
- `avatar.png` ou `avatar.avif`: foto de perfil correspondente.

Card e avatar nunca devem ser cadastrados, vendidos ou arquivados como produtos separados. Cada pasta deve usar apenas um formato por imagem.

## Estrutura

```text
store-packages/
├── README.md
├── catalog.json
├── piteco_prime/
│   ├── card.png
│   └── avatar.png
└── ...
```

O `id` em `catalog.json` deve ser idêntico ao nome da pasta. Depois da primeira publicação, esse ID é permanente: substituir uma arte não cria outro produto e não rompe compras, inventários ou itens equipados.

## Comandos

```bash
npm run store:validate
npm run store:sync
npm run store:sync -- --dry-run
```

A sincronização exige:

```text
SUPABASE_URL=https://xrnfhhoxmmstagmelvyi.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

Por segurança, o sincronizador recusa outro projeto Supabase, salvo quando `--allow-non-production` for usado explicitamente.

## Adicionar ou atualizar um pacote

1. Crie `store-packages/<id>/`.
2. Adicione `card.png` e `avatar.png`, ou o par em AVIF.
3. Registre ou atualize o pacote em `catalog.json`.
4. Execute a validação e a sincronização.

Trocar uma ou ambas as imagens mantendo o mesmo ID preserva o produto. A sincronização sobrescreve os objetos canônicos, remove formatos antigos da pasta do Storage e acrescenta um hash à URL para invalidar cache.

## Arquivar

Altere `active` para `false` e sincronize. O registro passa a `archived`, deixa de aparecer na loja e permanece disponível para inventários e compras históricas. Remover um item de `catalog.json` também o arquiva no banco; o fluxo normal nunca apaga registros referenciados.

## Publicação dinâmica

Um pacote aparece automaticamente quando `public_catalog` possui:

- `is_active = true`;
- `approved = true`;
- `status = published`;
- `type = bundle`;
- `card_final` e `avatar_final` válidos.

Nenhuma whitelist de frontend deve ser criada novamente.

## Avatares

Os avatares oficiais podem conter quadriculado incorporado nas bordas. A interface deve exibi-los dentro de contêiner circular com `overflow: hidden`, `object-fit: cover` e leve ampliação, sem gerar ou editar novas artes.
