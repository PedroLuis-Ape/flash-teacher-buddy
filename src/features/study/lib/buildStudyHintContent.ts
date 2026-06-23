export interface StudyHintSource {
  hint?: string | null;
  detailed_explanation?: string | null;
  usage_notes?: string | null;
  common_mistakes?: string | null;
}

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function buildStudyHintContent(source: StudyHintSource | null | undefined): string | null {
  if (!source) return null;

  const hint = clean(source.hint);
  const explanation = clean(source.detailed_explanation);
  const usageNotes = clean(source.usage_notes);
  const commonMistakes = clean(source.common_mistakes);
  const sections: string[] = [];

  if (hint) sections.push(hint);
  if (explanation) sections.push(`**Explicação detalhada**\n${explanation}`);
  if (usageNotes) sections.push(`**Quando usar**\n${usageNotes}`);
  if (commonMistakes) sections.push(`**Erros comuns**\n${commonMistakes}`);

  return sections.length > 0 ? sections.join("\n\n") : null;
}
