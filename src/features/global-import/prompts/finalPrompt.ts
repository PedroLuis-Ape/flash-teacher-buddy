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
        "- Não inclua campos pedagógicos enriquecidos nem word_hints.",
        "- Só inclua objetos layered quando o pedido exigir camadas ou sentidos agrupados.",
      ]
    : preset === "detailed"
      ? [
          "- Em todas as listas, glossary deve ser exatamente [].",
          "- Não inclua word_hints.",
          "- Campos pedagógicos são permitidos em cards normais e em cada layer.",
        ]
      : [
          "- Inclua glossary somente dentro das listas; não crie outro objeto global fora do contrato.",
          "- Remova duplicações de side + term + translation em todo o pacote.",
          "- Preserve word_hints e detalhes específicos de cada layer.",
        ];

  const classroomRules = context?.scope === "classroom" && preset === "complete"
    ? [
        "",
        "PADRÃO PEDAGÓGICO OBRIGATÓRIO PARA TURMA",
        "- Este conteúdo será usado por alunos; gere uma versão pedagogicamente completa por padrão.",
        "- Cada card normal e cada layer deve ter pelo menos detailed_explanation, example e example_translation, salvo impossibilidade semântica real.",
        "- Use short_observation, usage_notes e common_mistakes sempre que ajudarem o aluno a compreender uso, contexto ou contraste.",
        "- Crie word_hints para palavras, chunks ou expressões que possam dificultar a compreensão do card.",
        "- Inclua no glossary os termos e chunks relevantes do pacote, sem duplicar side + term + translation.",
        "- Use cards layered quando o mesmo termo tiver sentidos ou usos relacionados que devam permanecer agrupados.",
        "- Não preencha campos com texto genérico, repetido ou artificial apenas para parecer completo.",
        "- Cards, explicações e layers pertencem à turma atual; o glossary será centralizado na conta do professor pelo App Piteco.",
      ]
    : [];

  return [
    buildGlobalImportPresetPrompt(preset, context),
    "",
    "REGRA FINAL ESPECÍFICA DO MODO — TEM PRIORIDADE SOBRE O EXEMPLO DE ESTRUTURA",
    "O exemplo anterior demonstra o contrato completo. No JSON final, use somente os recursos autorizados pelo modo selecionado:",
    ...finalRules,
    ...classroomRules,
    "Revise o objeto inteiro e remova qualquer campo ou conteúdo proibido antes de responder.",
  ].join("\n");
}
