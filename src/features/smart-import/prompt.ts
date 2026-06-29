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

const NORMAL_CARD_EXAMPLE = `{
  "type": "normal",
  "front": "I am helping a customer.",
  "back": "Eu estou atendendo um cliente.",
  "detailed_explanation": "Help é natural em atendimento cotidiano."
}`;

const LAYERED_CARD_EXAMPLE = `{
  "type": "layered",
  "group_title": "Atender um cliente",
  "layers": [
    {
      "front": "I am helping a customer.",
      "back": "Eu estou atendendo um cliente.",
      "detailed_explanation": "Forma cotidiana."
    },
    {
      "front": "I am assisting a client.",
      "back": "Eu estou atendendo um cliente.",
      "detailed_explanation": "Forma mais formal."
    }
  ]
}`;

export function buildSmartImportPrompt(options: SmartImportPromptOptions): string {
  const languageA = options.languageA || "idioma do lado A";
  const languageB = options.languageB || "idioma do lado B";
  const quantity = options.cardCount ? `Gere aproximadamente ${options.cardCount} cards jogáveis.` : "Use uma quantidade adequada ao pedido.";
  const theme = options.theme?.trim() ? `Tema principal: ${options.theme.trim()}.` : "Use o tema informado pelo usuário.";

  const rules = [
    `O lado A deve usar ${languageA} e o lado B deve usar ${languageB}.`,
    quantity,
    theme,
    yesNoRule(options.includeGlobalGlossary, "Inclua glossário global com termos independentes, inclusive termos sobrepostos.", "Não crie glossário global; use glossary como array vazio."),
    yesNoRule(options.includeContextGlossary, "Inclua word_hints por card quando houver glossário contextual.", "Não crie word_hints."),
    yesNoRule(options.includeDetailedExplanations, "Inclua detailed_explanation quando agregar valor.", "Não crie detailed_explanation."),
    yesNoRule(options.includeUsageNotes, "Inclua usage_notes quando necessário.", "Não crie usage_notes."),
    yesNoRule(options.includeCommonMistakes, "Inclua common_mistakes quando necessário.", "Não crie common_mistakes."),
    yesNoRule(options.includeLayeredCards, "Você pode criar cards layered com group_title e pelo menos duas layers.", "Não crie cards layered."),
    "Não escreva explicações fora do formato solicitado.",
  ];

  if (options.outputFormat === "csv") {
    return [
      "Você gera conteúdo compatível com o importador inteligente 2.0 do App Piteco.",
      ...rules,
      "Entregue CSV puro, com uma linha de cabeçalho e campos entre aspas quando necessário.",
      "Cabeçalho recomendado: record_type,folder_name,list_name,key,parent_key,front,back,term,translation,side,note,occurrence,start_index,end_index,group_title,hint,short_observation,detailed_explanation,usage_notes,common_mistakes,example,example_translation,context_tag,tags,front_language,back_language,primary_side,study_type,label_a,label_b,tts_enabled",
      "Use record_type card, glossary, word_hint, layer_group ou layer.",
      "Use primary_side somente como a ou b minúsculos.",
      "Use side somente como A ou B maiúsculos.",
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

  const layeredRules = options.includeLayeredCards
    ? [
        "CARD LAYERED",
        "- Na raiz do grupo use somente type, key opcional, group_title e layers.",
        "- detailed_explanation, usage_notes, common_mistakes, hint, example, tags e word_hints pertencem a cada objeto dentro de layers.",
        "- Nunca coloque esses campos pedagógicos na raiz do grupo layered.",
        "- Cada grupo precisa ter pelo menos duas layers com front e back preenchidos.",
        LAYERED_CARD_EXAMPLE,
      ]
    : ["CARD LAYERED", "- Não use type layered, group_title nem layers."];

  return [
    "Você é o gerador oficial de JSON do Importador Inteligente 2.0 do App Piteco.",
    "O App Piteco validará a resposta com um schema estrito antes de gravar qualquer dado.",
    "",
    "OBJETIVO",
    ...rules.map((rule) => `- ${rule}`),
    "",
    "CONTRATO OBRIGATÓRIO DE SAÍDA",
    "- Responda com exatamente um objeto JSON puro e válido.",
    "- Não use Markdown, bloco de código, introdução, conclusão ou texto fora do JSON.",
    "- Use aspas duplas em todas as chaves e textos.",
    "- Não use aspas simples, comentários, reticências, campos incompletos nem vírgula final.",
    "- Use exatamente schema \"app-piteco-super-import\" e version \"2.0\".",
    "- Não adicione propriedades fora do contrato descrito abaixo.",
    "- declared_totals é opcional. Prefira omiti-lo; só inclua quando todas as contagens estiverem exatas.",
    "",
    "REGRAS DE CAIXA",
    "- primary_side aceita exclusivamente \"a\" ou \"b\" minúsculos.",
    "- side do glossary e dos word_hints aceita exclusivamente \"A\" ou \"B\" maiúsculos.",
    "- study_type aceita somente \"language\", \"general\", \"math\" ou \"visual\".",
    "",
    "ESTRUTURA",
    "- Raiz: schema, version e package.",
    "- package: name e folders; description, source_language, target_language, level e theme são opcionais.",
    "- folder: name e lists; description é opcional.",
    "- list: name, front_language, back_language, primary_side, study_type, glossary e cards; description, label_a, label_b e tts_enabled são opcionais.",
    "- glossary e cards devem ser arrays, mesmo quando vazios.",
    "",
    "CARD NORMAL",
    "- Obrigatórios: type=\"normal\", front e back.",
    "- Opcionais: key, hint, short_observation, detailed_explanation, usage_notes, common_mistakes, example, example_translation, context_tag, tags e word_hints.",
    "- front e back nunca podem ficar vazios.",
    NORMAL_CARD_EXAMPLE,
    "",
    ...layeredRules,
    "",
    "GLOSSÁRIO",
    "- Cada item aceita term, translation, side, note opcional e active.",
    "- term e translation são obrigatórios e não podem ficar vazios.",
    "- Preserve identidades independentes como because, of e because of.",
    "",
    "WORD_HINTS",
    "- Cada item aceita side, text, translation, note, occurrence, start_index e end_index.",
    "- occurrence aceita \"all\" ou um número inteiro não negativo.",
    "- start_index e end_index devem aparecer juntos; end_index deve ser maior.",
    "- Se não tiver certeza dos índices, omita os dois e use occurrence=\"all\".",
    "",
    "VALIDAÇÃO SILENCIOSA ANTES DA RESPOSTA",
    "1. Confirme que a resposta é JSON válido e contém apenas um objeto.",
    "2. Confirme schema e version exatos.",
    "3. Confirme primary_side minúsculo e side maiúsculo.",
    "4. Confirme que cards layered não possuem campos pedagógicos na raiz.",
    "5. Confirme que front, back, term, translation e group_title obrigatórios não estão vazios.",
    "6. Confirme que não há texto antes ou depois do JSON.",
  ].join("\n");
}
