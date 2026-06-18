export interface PromptListDraft {
  id: string;
  title: string;
  cardCount: number;
}

export interface PromptFolderDraft {
  id: string;
  title: string;
  lists: PromptListDraft[];
}

export interface PromptBuilderState {
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
  folders: PromptFolderDraft[];
}
