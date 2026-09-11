---
cssclasses:
  - ape-ai-note
---

# Data and Supabase

## Dois ambientes — NÃO CONFUNDIR
**[VERIFICADO-REPO]**

### Produção
`ymahldldyxvwjeruaxpr`

### Administração / migrations / diagnóstico
`xrnfhhoxmmstagmelvyi`

A consulta direta à produção foi negada neste checkup. O schema abaixo é do projeto administrativo.

## Tabelas observadas no admin
**[VERIFICADO-ADMIN-DB]**
Principais:
- `profiles`
- `folders`
- `lists`
- `flashcards`
- `collections`
- `flashcard_progress`
- `study_sessions`
- `study_session_answers`
- `folder_glossary`
- `list_glossary`
- `account_glossary`
- `global_import_batches`
- `global_import_items`
- `institutions`
- tabelas de economia/loja
- métricas web vitals
- bug reports.

## Flashcards
Campos relevantes observados:
- `id`, `collection_id`, `list_id`, `user_id`
- `term`, `translation`, `hint`
- `context_tag`
- `example_text`, `example_translation`
- `detailed_explanation`, `usage_notes`, `common_mistakes`, `short_explanation`
- `audio_url`, `image_url_a`, `image_url_b`
- `display_text`, `eval_text`
- `word_hints jsonb`
- `accepted_answers_en`, `accepted_answers_pt`
- `parent_card_id`, `layer_index`
- `status_group_uid`
- `deleted_at`.

### Evolução importante
Auditoria de junho dizia que `status_group_uid` não existia. No admin atual ele existe. Documentos antigos podem estar superados.

## Lists
Campos relevantes:
- folder/owner
- title/description
- visibility/class/institution
- study_type
- lang / lang_a / lang_b
- labels_a / labels_b
- tts_enabled
- `primary_side`
- deleted_at.

### Lado principal
**[HISTÓRICO + schema corroborado]**
`lists.primary_side` representa o lado principal persistente da lista. Não confundir com direção temporária da sessão.

## Study sessions
**[VERIFICADO-ADMIN-DB]**
Colunas observadas:
- id/user/list/mode
- current_index
- cards_order
- completed
- total/correct/wrong/skipped
- score
- started/completed timestamps
- reward_status/amount/breakdown
- timestamps.

Não foram observadas:
- `client_revision`
- `settings_snapshot`
- `session_snapshot`
- `session_scope_key`
- `schema_version`.

O código atual suporta caminho moderno + fallback legado.

## Glossário
### folder_glossary
- original_text
- primary_translation
- alternative_translations
- note
- side
- source_language / target_language
- is_active
- identity_key.

### list_glossary / account_glossary
original/tradução/note/side/active.

## Import
`global_import_batches`:
request id, hash, package/schema, status, options, summary, undo/timestamps.

`global_import_items`:
batch, entity type/id, action, path, metadata.

## Segurança
- não aplicar migrations em massa para “alinhar” ambiente;
- não trocar project ref;
- não mexer em Auth/RLS/RPC sem escopo explícito;
- 401/403 = hard stop;
- não criar fallback fictício.
