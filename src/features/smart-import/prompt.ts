export type SmartImportOutputFormat = "json" | "csv" | "text";

export interface SmartImportPromptOptions {
  languageA?: string;
  languageB?: string;
  theme?: string;
  cardCount?: number;
  outputFormat: SmartImportOutputFormat;
  includeGlobalGlossary?: boolean;
  includeContextGlossary?: boolean;
  includeDetailedExplanations?: boolean;
  includeUsageNotes?: boolean;
  includeCommonMistakes?: boolean;
  includeLayeredCards?: boolean;
}

const yesNoRule = (enabled: boolean | undefined, enabledText: string, disabledText: string) =>
  enabled ? enabledText : disabledText;

export function buildSmartImportPrompt(options: SmartImportPromptOptions): string {
  const languageA = options.languageA || "idioma do lado A";
  const languageB = options.languageB || "idioma do lado B";
  const quantity = options.cardCount ? `Gere aproximadamente ${options.cardCount} cards jogáveis.` : "Use uma quantidade adequada ao pedido.";
  const theme = options.theme?.trim() ? `Tema principal: ${options.theme.trim()}.` : "Use o tema informado pelo usuário.";

  const rules = [
    `O lado A deve usar ${languageA} e o lado B deve usar ${languageB}.`,
    quantity,
    theme,
    yesNoRule(options.includeGlobalGlossary, "Inclua glossário global com termos independentes, inclusive termos sobrepostos.", "Não crie glossário global."),
    yesNoRule(options.includeContextGlossary, "Inclua word_hints por card quando houver glossário contextual, preservando occurrence, start_index e end_index quando úteis.", "Não crie word_hints."),
    yesNoRule(options.includeDetailedExplanations, "Inclua detailed_explanation quando agregar valor.", "Não crie detailed_explanation."),
    yesNoRule(options.includeUsageNotes, "Inclua usage_notes quando necessário.", "Não crie usage_notes."),
    yesNoRule(options.includeCommonMistakes, "Inclua common_mistakes quando necessário.", "Não crie common_mistakes."),
    yesNoRule(options.includeLayeredCards, "Você pode criar cards layered com group_title e pelo menos duas layers.", "Não crie cards layered."),
    "Não misture explicações fora do formato solicitado.",
  ];

  if (options.outputFormat === "csv") {
    return [
      "Você gera conteúdo compatível com o importador inteligente 2.0 do App Piteco.",
      ...rules,
      "Entregue CSV puro, com uma linha de cabeçalho e campos entre aspas quando necessário.",
      "Cabeçalho recomendado: record_type,folder_name,list_name,key,parent_key,front,back,term,translation,side,note,occurrence,start_index,end_index,group_title,hint,short_observation,detailed_explanation,usage_notes,common_mistakes,example,example_translation,context_tag,tags,front_language,back_language,primary_side,study_type,label_a,label_b,tts_enabled",
      "Use record_type card, glossary, word_hint, layer_group ou layer.",
    ].join("\n");
  }

  if (options.outputFormat === "text") {
    return [
      "Você gera conteúdo compatível com o importador inteligente 2.0 do App Piteco.",
      ...rules,
      "Entregue texto puro.",
      "Use === GLOSSÁRIO GLOBAL === para glossário e === CARDS === para cards normais.",
      "Use termo / tradução em cada linha.",
      "Use [CAMADAS] antes de um grupo; na linha seguinte escreva o título e depois pelo menos duas linhas frente / verso.",
    ].join("\n");
  }

  return [
    "Você gera um único JSON válido para o importador inteligente 2.0 do App Piteco.",
    ...rules,
    "Use schema app-piteco-super-import e version 2.0.",
    "Estrutura obrigatória: package.name, package.folders[].name, package.folders[].lists[].name, front_language, back_language, primary_side, study_type, glossary e cards.",
    "Card normal: { type: 'normal', front, back }.",
    "Card layered: { type: 'layered', group_title, layers: [{ front, back }, ...] }.",
    "Glossário: { term, translation, side, note, active }.",
    "Glossário contextual: word_hints com side, text, translation, note, occurrence, start_index e end_index.",
    "Preserve identidades independentes como because, of e because of; não una termos sobrepostos.",
    "Responda somente com JSON puro, sem markdown.",
  ].join("\n");
}
