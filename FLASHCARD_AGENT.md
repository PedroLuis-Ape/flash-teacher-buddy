# FLASHCARD_AGENT.md — Governança de criação e importação

Fonte operacional para agentes que criam, enriquecem, organizam ou importam flashcards no App Piteco. A implementação real do projeto e do banco é a autoridade final; este arquivo não cria contrato paralelo.

## Pipeline

SOURCE → ANÁLISE SEMÂNTICA → SELEÇÃO → CLASSIFICAÇÃO → FOLDER → LIST → NORMAL/LAYERED CARD → ENRIQUECIMENTO → GLOSSÁRIO → VALIDAÇÃO → DESTINATION PLAN → SUPER IMPORT → BATCH/DATABASE → VERIFICAÇÃO.

Agentes MUST ler a fonte integralmente quando possível, priorizar C1/C2, B2 alto reutilizável, termos científicos/técnicos, collocations, phrasal verbs e expressões, e preservar unidades compostas como “synaptic plasticity”. MUST NOT transformar palavras triviais em cards sem valor, criar cópias do mesmo conceito ou tratar hipótese da fonte como fato estabelecido. Qualidade > quantidade.

## Hierarquia e destino

FOLDER > LIST > FLASHCARD > LAYERS opcionais. Uma folder é um domínio duradouro; uma list é uma fonte ou unidade coerente: vídeo, aula, artigo, podcast ou capítulo. Não criar pasta por vídeo. Antes de criar, descobrir o escopo correto, reutilizar equivalentes, resolver nomes em IDs atuais e montar destination_plan. Nunca inventar ou reutilizar IDs de memória. Cada conceito deve ter uma categoria principal.

## Card normal rico

No Smart Import 2.0, o card normal usa type normal, front e back não vazios, short_observation, detailed_explanation, usage_notes, common_mistakes, example, example_translation, context_tag, hint, word_hints e tags quando suportado. Não despejar toda a explicação em back. Não inventar campos fora do schema ativo. O termo deve ensinar inglês e, quando relevante, o conceito científico.

Exemplo válido:
{
  "type": "normal",
  "front": "synaptic plasticity",
  "back": "plasticidade sináptica",
  "short_observation": "Changes in synaptic strength support learning and memory.",
  "detailed_explanation": "The ability of synaptic connections between neurons to become stronger or weaker over time.",
  "usage_notes": "Common in neuroscience: induce plasticity; experience-dependent plasticity.",
  "common_mistakes": "Do not treat plasticity as unlimited change.",
  "example": "Learning depends partly on synaptic plasticity.",
  "example_translation": "A aprendizagem depende em parte da plasticidade sináptica.",
  "context_tag": "neuroscience",
  "hint": "Think about changing connection strength."
}

## Composição pedagógica canônica

Máximo de vocabulário útil dentro de uma frase natural, enxuta e fácil de revisar. Os geradores oficiais devem preferir 2 ou 3 termos que combinem naturalmente na mesma frase, reduzir para 1 ou 2 quando a naturalidade exigir e nunca transformar o card em parágrafo. Tradução fiel ao vocabulário-alvo e natural no idioma de destino; polissemia em cards contextualmente inequívocos; famílias lexicais e formas verbais relacionadas conectadas; nenhuma cópia de card quase idêntico só para ensinar uma palavra por vez.

A fonte única dessa regra é FLASHCARD_COMPOSITION_RULES em src/features/import-prompts/flashcardCompositionContract.ts, consumida por Smart Import 2.0, prompt simples, Super Importador legado/1.0, presets, final, owner/canário, layered e canonical. Não duplicar o texto do contrato em outros builders: prompts compostos herdam o contrato do builder de base.

## Verbos e cards layered

Formas do mesmo verbo MUST ficar no mesmo grupo lógico. Cada layer deve ter front e back não vazios e pode ter seus próprios exemplos, tradução, explicação, notas e word_hints. Usar o formato layered do importador; não simular camadas com inserts avulsos.

Exemplo válido:
{
  "type": "layered",
  "group_title": "undergo",
  "key": "undergo",
  "layers": [
    {"front": "undergo", "back": "passar por / sofrer", "example": "Patients may undergo neurological testing.", "example_translation": "Os pacientes podem passar por exames neurológicos."},
    {"front": "underwent", "back": "passou por / sofreu", "example": "The patient underwent additional testing.", "example_translation": "O paciente passou por exames adicionais."},
    {"front": "undergone", "back": "passado por / sofrido", "example": "The patient has undergone several examinations.", "example_translation": "O paciente passou por vários exames."}
  ]
}

O backend persiste pai e filhos ligados por parent_card_id e ordenados por layer_index. Não usar replace para pacotes layered quando o gateway rejeitar essa combinação; preferir skip.

## Glossários

Glossário é consulta rápida; flashcard é aprendizagem profunda. Para vocabulário reutilizável entre listas da mesma área, PREFERIR folder_glossary. Usar list_glossary apenas para termos específicos da fonte e account_glossary apenas para termos globais. Sincronizar por sync_folder_glossaries_from_super_import_v1; não criar mecanismo paralelo.

## Super Import 2.0

O pacote real contém schema, version, declared_totals opcional e package. package pode conter name, description, source_language, target_language, level, theme e folders. Cada folder contém name, description e lists. Cada list contém name, idiomas, configurações, glossary e cards.

Exemplo mínimo:
{
  "schema": "app-piteco-super-import",
  "version": "2.0",
  "declared_totals": {"folders": 1, "lists": 1, "cards": 1, "glossary_entries": 1, "layered_groups": 0},
  "package": {
    "name": "Neuroscience source",
    "source_language": "en",
    "target_language": "pt-BR",
    "level": "C1",
    "theme": "neuroscience",
    "folders": [{
      "name": "Neurociência e psicodélicos",
      "lists": [{
        "name": "StarTalk — Psychedelics & Neuroplasticity",
        "front_language": "en", "back_language": "pt-BR",
        "primary_side": "a", "study_type": "language", "tts_enabled": true,
        "glossary": [{"term": "critical period", "translation": "período crítico", "side": "A", "note": "Neuroscience term", "active": true}],
        "cards": [{"type": "normal", "front": "critical period", "back": "período crítico", "detailed_explanation": "A developmental window of heightened sensitivity to specific learning.", "example": "The treatment may reopen a critical period.", "example_translation": "O tratamento pode reabrir um período crítico.", "context_tag": "neuroscience"}]
      }]
    }]
  }
}

destination_plan separado:
{
  "folders": {
    "0": {
      "folder": {"mode": "existing", "folderId": "CURRENT_FOLDER_UUID"},
      "lists": {"0": {"mode": "existing", "listId": "CURRENT_LIST_UUID", "strategy": "append"}}
    }
  }
}

O gateway atual é import_app_piteco_super_package_current(request_id, payload, destination_plan, card_conflict, institution_id), que delega ao motor v3. Usar request_id UUID novo por operação, política conservadora skip e rastreamento global_import_batches/global_import_items. O fluxo oficial fornece relatório e undo; preferi-lo a inserts diretos.

## Validação

Antes de gravar: validar schema, limites, contagens, idiomas, lados, destinos, pertencimento, duplicatas, exemplos, traduções, coerência científica, glossário e compatibilidade de layered + replace. Confirmar autorização e escopo. Depois, conferir batch_id, request_id, status, pastas/listas criadas ou reutilizadas, cards criados/ignorados, grupos layered e glossário criado/atualizado. Em falha, usar undo oficial do batch.

Resultado esperado:
{"batch_id":"BATCH_UUID","request_id":"REQUEST_UUID","status":"completed","folders_created":0,"folders_reused":1,"lists_created":1,"lists_reused":0,"cards_created":12,"cards_skipped":2,"layered_groups_created":1,"glossary_created":8,"glossary_updated":1,"glossary_scope":"folder"}

## Divergências confirmadas

- src/features/global-import/schema/appPitecoSuperImportSchema.ts é legado 1.0 e aceita somente front/back; não usar para cards ricos.
- src/features/smart-import/schema.ts é Smart 2.0 e aceita campos ricos, layered e glossary.
- No Smart 2.0 o exemplo se chama example; APIs CRUD podem usar example_text. Não misturar contratos.
- O serviço usa destination_plan indexado, request_id, gateway current e sincronização de folder glossary.
- A implementação real prevalece. Não alterar a arquitetura para encaixar documentação.

## Fontes consultadas

AGENTS.md
src/features/smart-import/schema.ts
src/features/global-import/schema/appPitecoSuperImportSchema.ts
src/features/global-import/validation.ts
src/features/global-import/destination.ts
src/features/global-import/mappedService.ts
supabase/migrations/20260628151000_super_import_replace_card_policy.sql
supabase/migrations/20260701184500_layered_policy_guard.sql
supabase/migrations/20260629001835_publish_stable_super_import_rpc_gateway.sql
supabase/migrations/20260624120000_folder_glossary_v1.sql
