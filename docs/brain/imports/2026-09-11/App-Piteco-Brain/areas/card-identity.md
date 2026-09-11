---
cssclasses:
  - ape-ai-note
---

# Area — Card Identity

## Conceitos que não devem ser confundidos
- `flashcards.id`
- `parent_card_id`
- `status_group_uid`
- entrada jogável da sessão
- camada visível
- identidade persistente de progresso
- identidade canônica do grupo

## Contrato
Card normal pode usar seu próprio id.

Card em camadas exige diferenciar:
- grupo lógico;
- camada visível;
- entrada que o motor usa para avançar.

Favorito/vermelho tendem a ser status de grupo.
Especial pode ser por camada conforme o fluxo.

## Histórico
A auditoria de junho detectou fragilidade porque merge/unmerge podia trocar `parent_card_id`, deixando status persistido órfão.

## Evolução atual
**[VERIFICADO-ADMIN-DB]**
O schema administrativo atual possui `status_group_uid`, que não existia na auditoria antiga.

Isso indica evolução arquitetural.
Antes de corrigir status/favoritos:
- ler hooks atuais;
- ler RPCs atuais;
- verificar migrations atuais;
- testar cold mount + merge/unmerge.

## Regra
Nunca usar “primeira camada” como identidade persistente só porque ela é a entrada jogável.
