interface SmartJsonRepairResult {
  text: string;
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

export function repairSmartImportJsonText(input: string): SmartJsonRepairResult {
  const trimmed = input
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/i, "");

  if (!trimmed.startsWith("{")) return { text: input, changed: false, notes: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { text: input, changed: false, notes: [] };
  }

  const root = recordOf(parsed);
  if (root?.schema !== "app-piteco-super-import" || root.version !== "2.0") {
    return { text: input, changed: false, notes: [] };
  }

  const packageValue = recordOf(root.package);
  const folders = Array.isArray(packageValue?.folders) ? packageValue.folders : [];
  let usageNotesRepaired = 0;
  let commonMistakesRepaired = 0;

  const repairCard = (cardValue: unknown) => {
    const card = recordOf(cardValue);
    if (!card) return;

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
      const cards = Array.isArray(list?.cards) ? list.cards : [];
      cards.forEach((cardValue) => {
        const card = recordOf(cardValue);
        if (!card) return;
        if (card.type === "layered" && Array.isArray(card.layers)) {
          card.layers.forEach(repairCard);
        } else {
          repairCard(card);
        }
      });
    });
  });

  const total = usageNotesRepaired + commonMistakesRepaired;
  if (!total) return { text: input, changed: false, notes: [] };

  const notes = [
    `Correção automática aplicada em ${total} campo(s) que vieram como lista de textos.`,
  ];
  if (usageNotesRepaired) notes.push(`${usageNotesRepaired} campo(s) usage_notes foram convertidos para texto.`);
  if (commonMistakesRepaired) notes.push(`${commonMistakesRepaired} campo(s) common_mistakes foram convertidos para texto.`);

  return {
    text: JSON.stringify(parsed, null, 2),
    changed: true,
    notes,
  };
}
