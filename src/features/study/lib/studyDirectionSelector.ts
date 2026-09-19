import { normalizeDirection, type Direction } from "./resolveStudySides";

export interface StudyDirectionLabels {
  labelA: string;
  labelB: string;
}

export interface StudyDirectionOption {
  value: Direction;
  label: string;
  description: string;
}

export function buildStudyDirectionOptions(labels: StudyDirectionLabels): StudyDirectionOption[] {
  return [
    {
      value: "a-b",
      label: `${labels.labelA} → ${labels.labelB}`,
      description: `Mostra ${labels.labelA} primeiro`,
    },
    {
      value: "b-a",
      label: `${labels.labelB} → ${labels.labelA}`,
      description: `Mostra ${labels.labelB} primeiro`,
    },
    {
      value: "any",
      label: "Misturar os lados",
      description: "Alterna automaticamente o lado inicial",
    },
  ];
}

export function formatStudyDirection(
  direction: Direction | string,
  labels: StudyDirectionLabels,
  options: { locked?: boolean } = {},
): string {
  if (options.locked) return "Direção automática no modo gamificado";
  const choices = buildStudyDirectionOptions(labels);
  return choices.find((option) => option.value === normalizeDirection(direction))?.label
    ?? choices[2].label;
}
