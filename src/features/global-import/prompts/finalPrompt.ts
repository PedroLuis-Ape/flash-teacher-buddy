import {
  buildGlobalImportPresetPrompt,
  type GlobalImportAiPreset,
  type GlobalImportPromptDestinationContext,
} from "./presets";

export function buildFinalGlobalImportPrompt(
  preset: GlobalImportAiPreset,
  context?: GlobalImportPromptDestinationContext,
): string {
  const finalRules = preset === "batch"
    ? [
        "- Em todas as listas, glossary deve ser exatamente [].",
        "- Não inclua campos pedagógicos enriquecidos nem word_hints, exceto context_tag quando necessário para diferenciar interpretações.",
        "- Inclua somente cards com type=normal.",
      ]
    : preset === "detailed"
      ? [
          "- Em todas as listas, glossary deve ser exatamente [].",
          "- Não inclua word_hints.",
          "- Campos pedagógicos são permitidos somente em cards normais.",
          "- Inclua somente cards com type=normal.",
        ]
      : [
          "- Inclua glossary somente dentro das listas; não crie outro objeto global fora do contrato.",
          "- Remova duplicações de side + term + translation em todo o pacote.",
          "- Preserve word_hints e detalhes específicos de cada card normal.",
          "- Inclua somente cards com type=normal.",
        ];

  const classroomRules = context?.scope === "classroom" && preset === "complete"
    ? [
        "",
        "PADRÃO PEDAGÓGICO OBRIGATÓRIO PARA TURMA",
        "- Este conteúdo será usado por alunos; gere uma versão pedagogicamente completa por padrão.",
        "- Cada card deve ter pelo menos detailed_explanation, example e example_translation, salvo impossibilidade semântica real.",
        "- Use short_observation, usage_notes e common_mistakes sempre que ajudarem o aluno a compreender uso, contexto ou contraste.",
        "- Crie word_hints para palavras, chunks ou expressões que possam dificultar a compreensão do card.",
        "- Inclua no glossary os termos e chunks relevantes do pacote, sem duplicar side + term + translation.",
        "- Quando o mesmo termo tiver sentidos úteis diferentes, gere um card normal separado para cada sentido.",
        "- Exemplo: to be deve ter um card para ser e outro para estar quando ambos forem relevantes.",
        "- Não preencha campos com texto genérico, repetido ou artificial apenas para parecer completo.",
        "- Os cards e explicações pertencem à turma atual; o glossary será centralizado na conta do professor pelo App Piteco.",
      ]
    : [];

  return [
    buildGlobalImportPresetPrompt(preset, context),
    "",
    "REGRA FINAL ESPECÍFICA DO MODO — TEM PRIORIDADE SOBRE O EXEMPLO DE ESTRUTURA",
    "No JSON final, use somente os recursos autorizados pelo modo selecionado:",
    ...finalRules,
    ...classroomRules,
    "Revise o objeto inteiro e remova qualquer objeto layered, group_title ou layers antes de responder.",
  ].join("\n");
}
