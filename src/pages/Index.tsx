import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FlashcardList } from "@/components/FlashcardList";
import { CreateFlashcardForm } from "@/components/CreateFlashcardForm";
import { BookOpen, Plus, GraduationCap } from "lucide-react";
import heroImage from "@/assets/hero-bg.jpg";

interface FlashcardData {
  id: string;
  front: string;
  back: string;
}

const Index = () => {
  const [flashcards, setFlashcards] = useState<FlashcardData[]>([
    { id: "1", front: "Olá", back: "Hello" },
    { id: "2", front: "Obrigado", back: "Thank you" },
    { id: "3", front: "Por favor", back: "Please" },
  ]);
  const [showForm, setShowForm] = useState(false);

  const handleAddFlashcard = (front: string, back: string) => {
    const newCard: FlashcardData = {
      id: Date.now().toString(),
      front,
      back,
    };
    setFlashcards([...flashcards, newCard]);
    setShowForm(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section 
        className="relative bg-gradient-to-br from-primary via-primary-glow to-accent text-primary-foreground overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(135deg, hsl(250 70% 60% / 0.95), hsl(260 80% 70% / 0.95)), url(${heroImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <div className="flex justify-center mb-6">
              <GraduationCap className="h-16 w-16" />
            </div>
            <h1 className="text-5xl md:text-6xl font-bold mb-6">
              Flashcards de Inglês
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-95">
              Aprenda vocabulário de forma interativa e divertida
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                variant="hero"
                size="lg"
                onClick={() => setShowForm(!showForm)}
                className="shadow-xl"
              >
                <Plus className="mr-2 h-5 w-5" />
                Criar Novo Flashcard
              </Button>
              <Button 
                variant="secondary"
                size="lg"
                onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
              >
                <BookOpen className="mr-2 h-5 w-5" />
                Ver Flashcards
              </Button>
            </div>
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent pointer-events-none"></div>
      </section>

      {/* Create Form Section */}
      {showForm && (
        <section className="py-12 bg-muted/30">
          <div className="container mx-auto px-4 max-w-2xl">
            <h2 className="text-3xl font-bold mb-6 text-center">Criar Novo Flashcard</h2>
            <CreateFlashcardForm onAdd={handleAddFlashcard} />
          </div>
        </section>
      )}

      {/* Flashcards Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="mb-8 text-center">
            <h2 className="text-4xl font-bold mb-2">Seus Flashcards</h2>
            <p className="text-muted-foreground text-lg">
              Clique em um card para ver a tradução
            </p>
          </div>
          <FlashcardList flashcards={flashcards} />
        </div>
      </section>
    </div>
  );
};

export default Index;
