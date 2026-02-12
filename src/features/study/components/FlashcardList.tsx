import { Flashcard } from "./Flashcard";

interface FlashcardData {
  id: string;
  term: string;
  translation: string;
}

interface FlashcardListProps {
  flashcards: FlashcardData[];
}

export const FlashcardList = ({ flashcards }: FlashcardListProps) => {
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {flashcards.map((card) => (
        <Flashcard
          key={card.id}
          term={card.term}
          translation={card.translation}
        />
      ))}
    </div>
  );
};
