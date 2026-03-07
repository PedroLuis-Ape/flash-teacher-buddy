/**
 * StudyTypeConfig — feature flags per study type.
 * "required" = field is mandatory / always shown
 * "optional" = field is available but not required
 * "hidden"   = field is not shown
 */

export type FieldVisibility = "required" | "optional" | "hidden";

export interface StudyTypeFeatures {
  textA: FieldVisibility;
  textB: FieldVisibility;
  tts: FieldVisibility;
  imageA: FieldVisibility;
  imageB: FieldVisibility;
  defaultLabelA: string;
  defaultLabelB: string;
  icon: string; // lucide icon name
  label: string;
  description: string;
}

export const STUDY_TYPE_CONFIG: Record<string, StudyTypeFeatures> = {
  language: {
    textA: "required",
    textB: "required",
    tts: "optional",
    imageA: "hidden",
    imageB: "hidden",
    defaultLabelA: "English",
    defaultLabelB: "Português",
    icon: "Volume2",
    label: "Idiomas",
    description: "Texto + tradução + áudio (TTS)",
  },
  general: {
    textA: "required",
    textB: "required",
    tts: "hidden",
    imageA: "optional",
    imageB: "optional",
    defaultLabelA: "Frente",
    defaultLabelB: "Verso",
    icon: "BookOpen",
    label: "Estudo Geral",
    description: "Frente/Verso com imagens opcionais",
  },
  math: {
    textA: "required",
    textB: "required",
    tts: "hidden",
    imageA: "optional",
    imageB: "optional",
    defaultLabelA: "Pergunta",
    defaultLabelB: "Resposta",
    icon: "Calculator",
    label: "Matemática",
    description: "Perguntas e respostas com imagens opcionais",
  },
  visual: {
    textA: "optional",
    textB: "optional",
    tts: "optional",
    imageA: "required",
    imageB: "optional",
    defaultLabelA: "Imagem",
    defaultLabelB: "Descrição",
    icon: "Image",
    label: "Visual",
    description: "Estudo baseado em imagens",
  },
};

/** Returns config for a study type, falling back to "general" */
export function getStudyTypeConfig(studyType: string): StudyTypeFeatures {
  return STUDY_TYPE_CONFIG[studyType] || STUDY_TYPE_CONFIG.general;
}

/** Check if images are supported (optional or required) for a study type */
export function supportsImages(studyType: string): boolean {
  const config = getStudyTypeConfig(studyType);
  return config.imageA !== "hidden" || config.imageB !== "hidden";
}

/** Check if TTS is supported for a study type */
export function supportsTTS(studyType: string): boolean {
  const config = getStudyTypeConfig(studyType);
  return config.tts !== "hidden";
}
