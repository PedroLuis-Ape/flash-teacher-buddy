---
cssclasses:
  - ape-ai-note
---

# Import / Export

## Super Importador
**[HISTÓRICO]**
Em 18/06/2026 foi registrado Super Importador v1 com:
- contrato `app-piteco-super-import` 1.0;
- schema/prompt;
- validação estrita;
- preview;
- duplicatas;
- limites de 10 MB / 20.000 cards;
- rollback/idempotência;
- compatibilidade legada/CSV;
- testes/CI.

A migration de produção era pendente naquele momento. Não inferir estado atual.

## Inventário 08/09
**[VERIFICADO-REPO]**
- SuperGlobalImport V2
- Guided Global Import
- Owner Guided Import
- Smart Import / ContentIngestDialog
- importador de lista
- glossário de pasta
- glossário lista/conta
- coverage completion
- semantic review
- especiais/Bridge
- Kingdom CSV
- sync cards→glossary
- vídeos
- catálogo admin.

Não foi localizado importador ativo nativo de XLSX/Excel ou Anki/APKG.

## Harmonização
**[DECISÃO]**
Preservar gramáticas/parsers.
Harmonizar:
entrada → parse → validation → preview → confirm → persist → result.

Não criar parser universal para conteúdo diferente.

## Correções recentes
**[VERIFICADO-REPO]**
- leitor seguro compartilhado;
- leitura atrasada não substitui input novo;
- partial invalid rejeitado em CSV/glossário;
- busy state antecipado;
- bloqueio de fechamento crítico;
- Reino não finge sucesso parcial;
- rascunho preservado em erro.

## Export
Backup normal:
- lossless;
- sem reinterpretação.

Export semântico:
- frase completa;
- lado oposto;
- idioma;
- expressão;
- tradução atual;
- exemplos;
- posição/card ref.

Import semântico:
- preserva contexto;
- não promove sentido contextual a global.

## Round-trip obrigatório
`EXPORT → IMPORT → comparar identidade + conteúdo + semântica`.

## Pendências
- replace de glossário multi-lote não é transação global;
- collection/list identity;
- persistência autenticada real;
- mobile de dialogs/importers.
