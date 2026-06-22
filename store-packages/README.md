# Gerenciador oficial de pacotes da Loja do App Piteco

Esta pasta é o único ponto de entrada para adicionar, atualizar, arquivar ou remover pacotes visuais da loja.

## Regra central

Cada pacote é um único produto composto obrigatoriamente por:

- `card.avif`: card vertical colecionável;
- `avatar.avif`: foto de perfil correspondente.

Card e avatar nunca são produtos separados.

## Estrutura padrão

```text
store-packages/
├── catalog-v1.json
├── piteco_prime/
│   ├── card.avif
│   └── avatar.avif
├── piteco_vampiro/
│   ├── card.avif
│   └── avatar.avif
└── ...
```

O arquivo `catalog-v1.json` é a fonte única de nomes, IDs, raridades, preços e estado ativo.

## Adicionar um pacote

1. Criar `store-packages/<id_do_pacote>/`.
2. Adicionar `card.avif` e `avatar.avif`.
3. Registrar o pacote em `catalog-v1.json`.
4. Executar `npm run store:validate`.
5. Executar `npm run store:sync` em ambiente com `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

O sincronizador valida o conjunto, envia as imagens ao bucket `piteco-store` e atualiza `skins_catalog` e `public_catalog`.

## Atualizar uma arte

Substituir o card e/ou avatar na mesma pasta e sincronizar novamente. O ID do pacote deve permanecer igual para preservar compras, inventários e itens equipados.

## Arquivar

Alterar `active` para `false` no catálogo e sincronizar. O pacote some da loja, mas o histórico permanece.

## Excluir definitivamente

A exclusão física só deve ocorrer quando não houver referência em compras, inventários ou perfis. O comportamento padrão é arquivar.

## Raridades e preços atuais

- Raro: 300 PiteCOIN
- Épico: 500 PiteCOIN
- Lendário: 750 PiteCOIN

A loja não possui mais uma lista fixa de pacotes no frontend. Ela exibe tudo que estiver ativo e aprovado no catálogo do Supabase.
