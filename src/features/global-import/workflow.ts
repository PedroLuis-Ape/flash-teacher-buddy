import { parseGlobalImportText } from "./parser";
import { validateGlobalImportPackage, type GlobalImportValidationResult } from "./checks";
import {
  executeGlobalImport,
  type CardConflictPolicy,
  type ContainerConflictPolicy,
  type GlobalImportExecutionReport,
} from "./service";

export interface GlobalImportAnalysis {
  validation: GlobalImportValidationResult;
  notes: string[];
}

export interface GlobalImportPolicies {
  folder: ContainerConflictPolicy;
  list: ContainerConflictPolicy;
  card: CardConflictPolicy;
}

export interface GlobalImportProgress {
  completed: number;
  total: number;
  label: string;
}

export function analyzeGlobalImportText(text: string): GlobalImportAnalysis {
  const parsed = parseGlobalImportText(text);
  const notes: string[] = [];
  if (parsed.extracted) notes.push("O JSON foi extraído de texto ou Markdown ao redor.");
  if (parsed.repaired) notes.push("Vírgulas finais inválidas foram removidas com segurança.");
  return {
    validation: validateGlobalImportPackage(parsed.value),
    notes,
  };
}

export async function runGlobalImport(
  analysis: GlobalImportAnalysis,
  policies: GlobalImportPolicies,
  onProgress?: (progress: GlobalImportProgress) => void,
): Promise<GlobalImportExecutionReport> {
  if (!analysis.validation.valid || !analysis.validation.package) {
    throw new Error("O pacote possui erros bloqueantes e não pode ser importado.");
  }

  return executeGlobalImport(analysis.validation.package, {
    folderConflict: policies.folder,
    listConflict: policies.list,
    cardConflict: policies.card,
    institutionId: null,
    onProgress: (completed, total, label) => {
      onProgress?.({ completed, total, label });
    },
  });
}
