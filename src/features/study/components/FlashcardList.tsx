import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Flashcard } from "./Flashcard";

interface FlashcardData {
  id: string;
  term: string;
  translation: string;
}

interface FlashcardListProps {
  flashcards: FlashcardData[];
}

const ESTIMATED_ROW_HEIGHT = 160;

export const FlashcardList = ({ flashcards }: FlashcardListProps) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: flashcards.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 5,
  });

  if (flashcards.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">
          Nenhum flashcard ainda. Crie seu primeiro!
        </p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-[70vh] overflow-auto"
    >
      <div
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const card = flashcards[virtualRow.index];
          return (
            <div
              key={card.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
              ref={rowVirtualizer.measureElement}
              data-index={virtualRow.index}
            >
              <div className="pb-4">
                <Flashcard term={card.term} translation={card.translation} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
