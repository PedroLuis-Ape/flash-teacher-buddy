import type { GlossaryTransferEntry } from "./glossaryTransfer";

export type FolderGlossarySide = "A" | "B";
export type FolderGlossaryImportMode = "merge" | "replace";

export interface FolderGlossaryEntry extends GlossaryTransferEntry {
  id: string;
  folder_id: string;
  owner_id: string;
  class_id?: string | null;
  original_text_normalized?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FolderGlossaryImportResult {
  inserted: number;
  updated: number;
  replaced: number;
  skipped: number;
}

export interface FolderGlossaryAccess {
  folder_id: string;
  owner_id: string;
  class_id: string | null;
  can_read: boolean;
  can_manage: boolean;
}
