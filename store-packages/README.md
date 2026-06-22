# Gerenciador oficial de pacotes da Loja do App Piteco

Esta pasta é o único ponto de entrada para adicionar, atualizar, arquivar ou remover pacotes visuais da loja.

## Regra central

Um pacote é um único produto composto obrigatoriamente por:

- `card.avif`: card vertical colecionável;
- `avatar.avif`: foto de perfil correspondente;
- `manifest.json`: metadados e regras do pacote.

Card e avatar nunca devem ser tratados como produtos separados.

## Estrutura

```text
store-packages/
├── piteco_prime/
│   ├── manifest.json
│   ├── card.avif
│   └── avatar.avif
├── piteco_vampiro/
│   ├── manifest.json
│   ├── card.avif
│   └── avatar.avif
└── ...
```

O nome da pasta deve ser igual ao campo `id` do manifesto.

## Adicionar um pacote

1. Criar uma pasta em `store-packages/<id_do_pacote>/`.
2. Adicionar `manifest.json`, `card.avif` e `avatar.avif`.
3. Executar `npm run store:validate`.
4. Executar `npm run store:sync` em um ambiente que possua `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

O sincronizador:

- valida os dois arquivos visuais;
- envia os arquivos ao bucket público `piteco-store`;
- atualiza `skins_catalog` e `public_catalog`;
- mantém o mesmo ID quando a arte é substituída;
- não altera compras nem inventários existentes.

## Atualizar uma arte

Substituir `card.avif` e/ou `avatar.avif` dentro da mesma pasta e executar novamente a sincronização.

Não mudar o `id` do manifesto, pois ele identifica o pacote comprado pelos usuários.

## Arquivar um pacote

Alterar no manifesto:

```json
{
  "active": false
}
```

Depois executar a sincronização. O pacote deixa de aparecer na loja, mas compras e histórico permanecem preservados.

## Excluir definitivamente

A exclusão física deve ser usada somente quando não existe nenhuma referência em compras, inventários ou perfis.

Por padrão, o sincronizador arquiva em vez de apagar registros.

## Contrato do manifesto

```json
{
  "schema": "app-piteco-store-package",
  "version": 1,
  "id": "piteco_exemplo",
  "slug": "piteco_exemplo",
  "name": "Piteco Exemplo",
  "description": "Descrição curta.",
  "rarity": "rare",
  "price_pitecoin": 300,
  "active": true,
  "assets": {
    "card": "card.avif",
    "avatar": "avatar.avif"
  }
}
```

Raridades aceitas:

- `normal`
- `rare`
- `epic`
- `legendary`

## Valores atuais por raridade

- Raro: 300 PiteCOIN
- Épico: 500 PiteCOIN
- Lendário: 750 PiteCOIN

Esses valores são referências atuais, não uma limitação técnica. O preço definitivo sempre é o campo `price_pitecoin` do manifesto e do catálogo do Supabase.
