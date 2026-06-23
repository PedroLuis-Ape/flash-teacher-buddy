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

  return [
    buildGlobalImportPresetPrompt(preset, context),
    "",
    "REGRA FINAL ESPECÍFICA DO MODO — TEM PRIORIDADE SOBRE O EXEMPLO DE ESTRUTURA",
    "O exemplo anterior demonstra o contrato completo. No JSON final, use somente os recursos autorizados pelo modo selecionado:",
    ...finalRules,
    "Revise o objeto inteiro e remova qualquer campo ou conteúdo proibido antes de responder.",
  ].join("\n");
}
