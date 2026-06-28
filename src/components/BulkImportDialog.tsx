import { ContentIngestDialog } from "@/features/smart-import/ContentIngestDialog";

interface BulkImportDialogProps {
  collectionId: string;
  existingCards: { term: string; translation: string }[];
  existingGlossary?: { original_text: string; translated_text: string }[];
  onImported: () => void;
  labelA?: string;
  labelB?: string;
  langA?: string;
  langB?: string;
}

export const BulkImportDialog = ({
  collectionId,
  existingCards,
  onImported,
  labelA,
  labelB,
  langA,
  langB,
}: BulkImportDialogProps) => (
  <ContentIngestDialog
    listId={collectionId}
    existingCards={existingCards}
    onImported={onImported}
    labelA={labelA}
    labelB={labelB}
    langA={langA}
    langB={langB}
  />
);
