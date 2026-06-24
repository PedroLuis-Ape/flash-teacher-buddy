export type GlossarySide = "A" | "B";

export interface FolderGlossaryEntry {
  id: string;
  folder_id: string;
  owner_id: string;
  original_text: string;
  primary_translation: string;
  alternative_translations: string[];
  note: string | null;
  side: GlossarySide;
  source_language: string | null;
  target_language: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  can_edit?: boolean;
}

export interface FolderGlossaryInput {
  term: string;
  translation: string;
  alternatives?: string[];
  note?: string | null;
  side?: GlossarySide;
  source_language?: string | null;
  target_language?: string | null;
  active?: boolean;
}

export interface FolderGlossaryImportResult {
  folder_id: string;
  mode: "merge" | "replace";
  dry_run: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  removed: number;
}

export interface FolderGlossaryQueryResult {
  entries: FolderGlossaryEntry[];
  canEdit: boolean;
}
