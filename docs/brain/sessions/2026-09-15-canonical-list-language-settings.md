# Sessão — autoridade canônica de idioma A/B

Data: 2026-09-15
Status: implementação aditiva e retrocompatível

## Problema observado

O Super Importador recebeu um pacote coerente `en -> pt-BR`, com a própria lista declarando `front_language=en` e `back_language=pt-BR`, mas a validação podia acusar que os lados não correspondiam à lista de destino.

A causa estrutural não era a identidade física do card. A convenção vigente continua correta:

- lado A = `front` = `term` = `lang_a`;
- lado B = `back` = `translation` = `lang_b`;
- direção de estudo (`a-b`, `b-a`, `any`) escolhe prompt/resposta, mas nunca redefine a identidade física A/B.

A ambiguidade estava em `resolveEffectiveListSettings`: historicamente, `lists.lang_a/lang_b` e `folders.lang_a/lang_b` nasceram com defaults `en/pt`. Assim, uma lista realmente configurada como `en/pt` era indistinguível de uma lista que apenas carregava defaults e deveria herdar a pasta.

## Novo contrato

`lists.language_settings_mode` passa a declarar explicitamente a autoridade das configurações:

- `explicit`: a lista é autoridade para `study_type`, `lang_a`, `lang_b`, labels e TTS;
- `inherited`: a pasta é autoridade;
- `legacy`: preserva exatamente a heurística histórica para listas anteriores ao contrato.

Coleções de sistema (`reinforcement` e `attention_points`) continuam sendo tratadas como `explicit` no runtime, porque sua metadata materializada não pode ser sobrescrita por uma pasta contraditória.

## Compatibilidade

A migration é deliberadamente aditiva:

- nenhum `flashcards.term` é alterado;
- nenhum `flashcards.translation` é alterado;
- nenhuma layer é reordenada ou reescrita;
- nenhuma lista existente é atualizada em massa: `language_settings_mode=NULL` é interpretado como `legacy`;
- portanto, listas antigas continuam usando a mesma resolução anterior;
- inserts antigos que não declaram estudo/idioma permanecem `legacy`.

Quando uma lista passa a receber alterações explícitas de estudo/idioma depois do contrato, um trigger a promove para `explicit`, exceto quando o chamador troca deliberadamente o modo para `inherited`.

## Super Importador

Pacotes do Super Importador declaram `front_language/back_language`. Toda lista NOVA criada pelo Super Importador é marcada como `explicit` através do registro já existente em `global_import_items` (`entity_type=list`, `action=created`). Isso evita reescrever os vários RPCs históricos de importação.

No catálogo do importador, `system_kind` e `language_settings_mode` passam a ser carregados. Há fallback para o select legado caso o frontend seja publicado antes da migration: nessa janela, as listas simplesmente continuam sendo tratadas como `legacy`.

Ao criar lista nova dentro de uma pasta existente, a direção da pasta NÃO é usada para bloquear o pacote. Compatibilidade de lados só se aplica quando o plano realmente aponta para uma lista existente.

## Resolvedor

`resolveEffectiveListSettings` passa a ser a autoridade de metadata de lista/pasta:

1. `explicit` -> lista;
2. `inherited` -> pasta;
3. `legacy`/ausente/desconhecido -> heurística anterior, sem mudança de comportamento.

O retorno agora também expõe `languageSettingsMode`, permitindo que consumidores migrem gradualmente sem inferência baseada no par `en/pt`.

## Testes de regressão

Cobertura adicionada para:

- lista `explicit` en/pt permanecer en/pt mesmo dentro de pasta pt/en;
- lista `inherited` usar deliberadamente a pasta;
- lista sem modo continuar `legacy`;
- coleção de sistema nunca herdar direção contraditória;
- Super Import criar lista nova dentro de pasta com direção oposta sem falso bloqueio;
- consolidação em lista `explicit` compatível não gerar falso erro;
- lista `legacy` preservar o fallback histórico.

## Limite preservado nesta etapa

`Study` e `MixedStudy` ainda mantêm `resolveDeckOrientation()` como salvaguarda conservadora para decks legados cuja metadata contradiz fortemente o conteúdo. Esta mudança não reescreve essa heurística nem os cards existentes.

O objetivo desta etapa é remover a ambiguidade daqui para frente sem alterar silenciosamente decks antigos. Uma evolução futura pode propagar `language_settings_mode` também ao carregamento específico do Study/Mixed e usar a inferência por conteúdo apenas como diagnóstico para listas `explicit`.
