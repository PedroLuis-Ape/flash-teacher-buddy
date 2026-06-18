export interface PromptListModel {
  id: string;
  name: string;
  cardCount: number;
}

export interface PromptFolderModel {
  id: string;
  name: string;
  lists: PromptListModel[];
}

export interface PromptBuilderModel {
  packageName: string;
  description: string;
  studyType: "language" | "general" | "math" | "visual";
  sourceLanguage: string;
  targetLanguage: string;
  labelA: string;
  labelB: string;
  level: string;
  theme: string;
  includeExamples: boolean;
  includeExplanations: boolean;
  preventRepetitions: boolean;
  ttsEnabled: boolean;
  extraInstructions: string;
  folders: PromptFolderModel[];
}

export interface SavedPromptModel {
  id: string;
  name: string;
  savedAt: string;
  value: PromptBuilderModel;
}

const STORAGE_KEY = "ape-global-import-prompt-models-v1";
let sequence = 0;

export function promptModelId(): string {
  sequence += 1;
  return `prompt-${Date.now()}-${sequence}`;
}

export function newPromptList(name = "", cardCount = 10): PromptListModel {
  return { id: promptModelId(), name, cardCount };
}

export function newPromptFolder(name = ""): PromptFolderModel {
  return { id: promptModelId(), name, lists: [newPromptList()] };
}

export function initialPromptBuilderModel(): PromptBuilderModel {
  return {
    packageName: "",
    description: "",
    studyType: "language",
    sourceLanguage: "",
    targetLanguage: "",
    labelA: "",
    labelB: "",
    level: "",
    theme: "",
    includeExamples: true,
    includeExplanations: true,
    preventRepetitions: true,
    ttsEnabled: true,
    extraInstructions: "",
    folders: [newPromptFolder()],
  };
}

export function movePromptModelItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function readSavedPromptModels(): SavedPromptModel[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(value) ? value as SavedPromptModel[] : [];
  } catch {
    return [];
  }
}

export function writeSavedPromptModels(models: SavedPromptModel[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(models.slice(0, 30)));
}
