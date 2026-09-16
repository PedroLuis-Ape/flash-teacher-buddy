export interface StudyHintSource {
  hint?: string | null;
  detailed_explanation?: string | null;
  usage_notes?: string | null;
  common_mistakes?: string | null;
}

const EXPLANATION_MARKER = "**Explicação detalhada**";
const USAGE_MARKER = "**Quando usar**";
const MISTAKES_MARKER = "**Erros comuns**";

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function mergeUnique(primary: string | null, legacy: string | null): string | null {
  if (!primary) return legacy;
  if (!legacy || primary === legacy || primary.includes(legacy)) return primary;
  if (legacy.includes(primary)) return legacy;
  return `${primary}\n\n${legacy}`;
}

function parseLegacyRichHint(rawHint: string | null): {
  hint: string | null;
  explanation: string | null;
  usageNotes: string | null;
  commonMistakes: string | null;
} {
  if (!rawHint) {
    return { hint: null, explanation: null, usageNotes: null, commonMistakes: null };
  }

  const starts = [EXPLANATION_MARKER, USAGE_MARKER, MISTAKES_MARKER]
    .map((marker) => rawHint.indexOf(marker))
    .filter((index) => index >= 0);

  if (starts.length === 0) {
    return { hint: rawHint, explanation: null, usageNotes: null, commonMistakes: null };
  }

  const richStart = Math.min(...starts);
  const plainHint = clean(rawHint.slice(0, richStart));

  const readSection = (marker: string, nextMarkers: string[]): string | null => {
    const start = rawHint.indexOf(marker);
    if (start < 0) return null;
    const bodyStart = start + marker.length;
    const candidates = nextMarkers
      .map((nextMarker) => rawHint.indexOf(nextMarker, bodyStart))
      .filter((index) => index >= 0);
    const bodyEnd = candidates.length > 0 ? Math.min(...candidates) : rawHint.length;
    return clean(rawHint.slice(bodyStart, bodyEnd));
  };

  return {
    hint: plainHint,
    explanation: readSection(EXPLANATION_MARKER, [USAGE_MARKER, MISTAKES_MARKER]),
    usageNotes: readSection(USAGE_MARKER, [MISTAKES_MARKER]),
    commonMistakes: readSection(MISTAKES_MARKER, []),
  };
}

export function buildStudyHintContent(source: StudyHintSource | null | undefined): string | null {
  if (!source) return null;

  const legacy = parseLegacyRichHint(clean(source.hint));
  const hint = legacy.hint;
  const explanation = mergeUnique(clean(source.detailed_explanation), legacy.explanation);
  const usageNotes = mergeUnique(clean(source.usage_notes), legacy.usageNotes);
  const commonMistakes = mergeUnique(clean(source.common_mistakes), legacy.commonMistakes);
  const sections: string[] = [];

  if (hint) sections.push(hint);
  if (explanation) sections.push(`${EXPLANATION_MARKER}\n${explanation}`);
  if (usageNotes) sections.push(`${USAGE_MARKER}\n${usageNotes}`);
  if (commonMistakes) sections.push(`${MISTAKES_MARKER}\n${commonMistakes}`);

  return sections.length > 0 ? sections.join("\n\n") : null;
}
