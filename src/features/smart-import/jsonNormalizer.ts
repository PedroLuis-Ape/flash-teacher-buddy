interface SmartImportJsonNormalizationResult {
  value: unknown;
  changed: boolean;
  notes: string[];
}

function recordOf(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stringList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length === value.length ? items : null;
}

const SHARED_LAYER_FIELDS = [
  "hint",
  "short_observation",
  "detailed_explanation",
  "usage_notes",
  "common_mistakes",
  "example",
  "example_translation",
  "context_tag",
  "tags",
  "word_hints",
] as const;

function hasMeaningfulValue(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return Boolean(value.trim());
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

export function normalizeSmartImportJsonValue(
  value: unknown,
): SmartImportJsonNormalizationResult {
  const root = recordOf(value);
  if (root?.schema !== "app-piteco-super-import" || root.version !== "2.0") {
    return { value, changed: false, notes: [] };
  }

  const packageValue = recordOf(root.package);
  const folders = Array.isArray(packageValue?.folders) ? packageValue.folders : [];
  let primarySidesNormalized = 0;
  let layeredGroupsNormalized = 0;
  let usageNotesRepaired = 0;
  let commonMistakesRepaired = 0;

  const repairTextArrays = (card: Record<string, unknown>) => {
    const usageNotes = stringList(card.usage_notes);
    if (usageNotes) {
      card.usage_notes = usageNotes.join("\n");
      usageNotesRepaired += 1;
    }

    const commonMistakes = stringList(card.common_mistakes);
    if (commonMistakes) {
      card.common_mistakes = commonMistakes.join("\n");
      commonMistakesRepaired += 1;
    }
  };

  folders.forEach((folderValue) => {
    const folder = recordOf(folderValue);
    const lists = Array.isArray(folder?.lists) ? folder.lists : [];
    lists.forEach((listValue) => {
      const list = recordOf(listValue);
      if (!list) return;

      if (typeof list.primary_side === "string") {
        const normalizedSide = list.primary_side.trim().toLocaleLowerCase();
        if ((normalizedSide === "a" || normalizedSide === "b") && normalizedSide !== list.primary_side) {
          list.primary_side = normalizedSide;
          primarySidesNormalized += 1;
        }
      }

      const cards = Array.isArray(list.cards) ? list.cards : [];
      cards.forEach((cardValue) => {
        const card = recordOf(cardValue);
        if (!card) return;

        if (card.type !== "layered" || !Array.isArray(card.layers)) {
          repairTextArrays(card);
          return;
        }

        let groupChanged = false;
        const layers = card.layers
          .map(recordOf)
          .filter((layer): layer is Record<string, unknown> => Boolean(layer));

        for (const field of SHARED_LAYER_FIELDS) {
          const sharedValue = card[field];
          if (!hasMeaningfulValue(sharedValue)) continue;

          layers.forEach((layer) => {
            if (!hasMeaningfulValue(layer[field])) layer[field] = sharedValue;
          });
          delete card[field];
          groupChanged = true;
        }

        layers.forEach(repairTextArrays);
        if (groupChanged) layeredGroupsNormalized += 1;
      });
    });
  });

  const notes: string[] = [];
  if (primarySidesNormalized) {
    notes.push(`${primarySidesNormalized} primary_side em maiúscula foi normalizado para “a” ou “b”.`);
  }
  if (layeredGroupsNormalized) {
    notes.push(`${layeredGroupsNormalized} grupo(s) layered tiveram explicações compartilhadas distribuídas para suas camadas.`);
  }
  const textArrayRepairs = usageNotesRepaired + commonMistakesRepaired;
  if (textArrayRepairs) {
    notes.push(`${textArrayRepairs} campo(s) de observação em formato de lista foram convertidos para texto.`);
  }

  return {
    value,
    changed: notes.length > 0,
    notes,
  };
}
