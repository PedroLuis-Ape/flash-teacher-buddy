import { supabase } from "@/integrations/supabase/client";
import type { GlossaryTransferEntry } from "@/features/study/lib/glossaryTransfer";

export interface BulkGlossaryImportReport {
  success: boolean;
  dry_run: boolean;
  requires_confirmation: boolean;
  folders_targeted: number;
  lists_targeted: number;
  entries_received: number;
  total_applications: number;
  inserted: number;
  updated: number;
  skipped_exact: number;
  added_as_layer: number;
}

export interface BulkGlossaryImportOptions {
  folderIds: string[];
  entries: GlossaryTransferEntry[];
  turmaId?: string | null;
  confirmExisting?: boolean;
}

void supabase;
