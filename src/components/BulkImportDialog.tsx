import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { parsePastedFlashcards, deduplicateFlashcards, FlashcardPair } from "@/lib/bulkImport";
import { supabase } from "@/integrations/supabase/client";

interface BulkImportDialogProps {
  collectionId: string;
  existingCards: { term: string; translation: string }[];
  onImported: () => void;
}

export const BulkImportDialog = ({
  collectionId,
  existingCards,
  onImported,
}: BulkImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<FlashcardPair[]>([]);
  const [stats, setStats] = useState({ valid: 0, incomplete: 0, duplicates: 0 });
  const [loading, setLoading] = useState(false);

  const handleParse = () => {
    if (!input.trim()) {
      toast.error("Cole o conteúdo dos flashcards");
      return;
    }

    const parsed = parsePastedFlashcards(input);
    const deduplicated = deduplicateFlashcards(parsed, existingCards);

    const valid = deduplicated.filter(p => p.en && p.pt).length;
    const incomplete = deduplicated.filter(p => !p.en || !p.pt).length;
    const duplicates = parsed.length - deduplicated.length;

    setPreview(deduplicated);
    setStats({ valid, incomplete, duplicates });
  };

  const handleImport = async () => {
    const validPairs = preview.filter(p => p.en && p.pt);
    
    if (validPairs.length === 0) {
      toast.error("Nenhum par válido para importar");
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logado");
      setLoading(false);
      return;
    }

    const flashcards = validPairs.map(pair => ({
      list_id: collectionId,
      user_id: user.id,
      term: pair.pt!,
      translation: pair.en!,
      accepted_answers_en: [],
      accepted_answers_pt: [],
    }));

    const { error } = await supabase.from("flashcards").insert(flashcards);

    if (error) {
      toast.error("Erro ao importar flashcards");
      console.error(error);
    } else {
      toast.success(`${validPairs.length} flashcards importados!`);
      setInput("");
      setPreview([]);
      setOpen(false);
      onImported();
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Importar por Colagem
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Flashcards em Lote</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="bulk-input">
              Cole os flashcards (um por linha)
            </Label>
            <p className="text-sm text-muted-foreground">
              Formatos aceitos:<br />
              • <code>English phrase / Tradução em português</code><br />
              • <code>Tradução em português / English phrase</code><br />
              • Frases únicas (auto-detecta idioma)
            </p>
            <Textarea
              id="bulk-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Hello / Olá\nGoodbye / Tchau\nHow are you? / Como vai?`}
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <Button onClick={handleParse} variant="secondary" className="w-full">
            Pré-visualizar
          </Button>

          {preview.length > 0 && (
            <>
              <Alert>
                <AlertDescription className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>{stats.valid} válidos</span>
                  </div>
                  {stats.incomplete > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-yellow-600" />
                      <span>{stats.incomplete} incompletos (serão ignorados)</span>
                    </div>
                  )}
                  {stats.duplicates > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-600" />
                      <span>{stats.duplicates} duplicados (removidos)</span>
                    </div>
                  )}
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                <h4 className="font-semibold mb-2 text-sm">Pré-visualização:</h4>
                <ul className="space-y-1 text-sm">
                  {preview.slice(0, 20).map((pair, idx) => (
                    <li key={idx} className={!pair.en || !pair.pt ? "text-muted-foreground" : ""}>
                      {pair.pt || "?"} → {pair.en || "?"}
                    </li>
                  ))}
                  {preview.length > 20 && (
                    <li className="text-muted-foreground italic">
                      ...e mais {preview.length - 20}
                    </li>
                  )}
                </ul>
              </div>

              <Button 
                onClick={handleImport} 
                disabled={loading || stats.valid === 0}
                className="w-full"
              >
                {loading ? "Importando..." : `Importar ${stats.valid} flashcard${stats.valid !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
