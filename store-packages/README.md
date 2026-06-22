# Gerenciador oficial de pacotes da Loja do App Piteco

Este diretório é a fonte canônica dos pacotes visuais publicados na loja.

## Regra estrutural

Cada pacote é um único produto inseparável, composto obrigatoriamente por:

- `card.avif`: card colecionável vertical;
- `avatar.avif`: foto de perfil correspondente.

Card e avatar nunca devem ser cadastrados, vendidos ou arquivados como produtos separados.

## Estrutura

```text
store-packages/
├── README.md
├── catalog.json
├── piteco_prime/
│   ├── card.avif
│   └── avatar.avif
└── ...
```

O `id` de cada item em `catalog.json` deve ser idêntico ao nome da pasta. Depois da primeira publicação, esse ID é permanente: substituir a arte não cria um novo produto e não rompe compras, inventários ou itens equipados.

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

Por segurança, o sincronizador recusa outro projeto Supabase, salvo quando a opção explícita `--allow-non-production` for usada.

## Adicionar um pacote

1. Crie `store-packages/<id>/`.
2. Adicione `card.avif` e `avatar.avif`.
3. Registre o pacote em `catalog.json`.
4. Execute a validação e a sincronização.

## Substituir uma arte

Troque `card.avif`, `avatar.avif` ou ambos, mantendo o mesmo ID. A sincronização sobrescreve os objetos canônicos e acrescenta um hash à URL apenas para invalidar cache.

## Arquivar

Altere `active` para `false` e sincronize. O registro passa a `archived`, deixa de aparecer na loja e permanece disponível para inventários e compras históricas.

Remover um item de `catalog.json` também o arquiva no banco. O fluxo normal nunca apaga registros referenciados.

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
