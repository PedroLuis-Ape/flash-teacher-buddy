export interface LayeredCardDraft {
  id?: string;
  front: string;
  back: string;
  example?: string | null;
  exampleTranslation?: string | null;
}

function cleanOptional(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function normalizeLayeredCardDrafts(
  layers: readonly LayeredCardDraft[],
): LayeredCardDraft[] {
  return layers.map((layer) => ({
    ...(layer.id ? { id: layer.id } : {}),
    front: layer.front.trim(),
    back: layer.back.trim(),
    ...(cleanOptional(layer.example) ? { example: cleanOptional(layer.example) } : {}),
    ...(cleanOptional(layer.exampleTranslation)
      ? { exampleTranslation: cleanOptional(layer.exampleTranslation) }
      : {}),
  }));
}

function duplicateKey(layer: LayeredCardDraft): string {
  return `${layer.front.trim().toLocaleLowerCase()}\u0000${layer.back.trim().toLocaleLowerCase()}`;
}

export function validateLayeredCardDrafts(
  layers: readonly LayeredCardDraft[],
): string[] {
  const errors: string[] = [];
  if (layers.length < 2) {
    errors.push("Um card em camadas precisa ter pelo menos duas camadas.");
  }
  if (layers.length > 500) {
    errors.push("Um card em camadas pode ter no máximo 500 camadas.");
  }

  const seen = new Set<string>();
  layers.forEach((layer, index) => {
    if (!layer.front.trim() || !layer.back.trim()) {
      errors.push(`A Camada ${index + 1} precisa ter conteúdo nos dois lados.`);
      return;
    }
    const key = duplicateKey(layer);
    if (seen.has(key)) {
      errors.push(`A Camada ${index + 1} repete exatamente outra camada deste card.`);
      return;
    }
    seen.add(key);
  });

  return errors;
}

export function moveLayerDraft<T>(
  layers: readonly T[],
  index: number,
  direction: -1 | 1,
): T[] {
  const target = index + direction;
  if (index < 0 || index >= layers.length || target < 0 || target >= layers.length) {
    return [...layers];
  }
  const next = [...layers];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}