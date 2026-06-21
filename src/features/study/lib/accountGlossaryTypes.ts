import type { GlossaryTransferEntry } from "./glossaryTransfer";

export interface AccountGlossaryEntry extends GlossaryTransferEntry {
  id: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
}
