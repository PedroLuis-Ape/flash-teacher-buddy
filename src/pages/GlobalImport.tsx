import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Upload, FileText } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { parsePastedFlashcards, deduplicateFlashcards } from "@/lib/bulkImport";

const CHUNK_SIZE = 200;

export default function GlobalImport() {
  const navigate = useNavigate();
  const [pastedText, setPastedText] = useState("");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");

  // Fetch user's lists (where they are owner)
  const { data: userData } = useQuery({
    queryKey: ["current-user-for-import"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  const { data: userLists = [], isLoading: listsLoading } = useQuery({
    queryKey: ["user-lists-for-import", userData?.id],
    queryFn: async () => {
      if (!userData?.id) return [];
      
      const { data, error } = await supabase
        .from("lists")
        .select("id, title, folder_id, folders(title)")
        .eq("owner_id", userData.id)
        .order("title", { ascending: true });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!userData?.id,
  });

  // Fetch existing cards for the selected list
  const { data: existingCards = [] } = useQuery({
    queryKey: ["existing-cards-for-import", selectedListId],
    queryFn: async () => {
      if (!selectedListId) return [];
      
      // Use pagination to get ALL cards (not just 1000)
      let allCards: { term: string; translation: string }[] = [];
      let offset = 0;
      const pageSize = 1000;
      
      while (true) {
        const { data, error } = await supabase
          .from("flashcards")
          .select("term, translation")
          .eq("list_id", selectedListId)
          .range(offset, offset + pageSize - 1);
        
        if (error) throw error;
        if (!data || data.length === 0) break;
        
        allCards = [...allCards, ...data];
        if (data.length < pageSize) break;
        offset += pageSize;
      }
      
      return allCards;
    },
    enabled: !!selectedListId,
  });

  const handleImport = async () => {
    if (!pastedText.trim()) {
      toast.error("Cole o texto para importar");
      return;
    }
    if (!selectedListId) {
      toast.error("Selecione uma lista destino");
      return;
    }
    if (!userData?.id) {
      toast.error("Você precisa estar logado");
      return;
    }

    setIsImporting(true);
    setProgress(0);
    setProgressText("Processando texto...");

    try {
      // Parse the pasted text
      const parsed = parsePastedFlashcards(pastedText);
      
      if (parsed.length === 0) {
        toast.error("Nenhum card válido encontrado. Use o formato: Termo / Tradução");
        setIsImporting(false);
        return;
      }

      // Deduplicate against existing cards
      const uniqueCards = deduplicateFlashcards(parsed, existingCards);
      
      if (uniqueCards.length === 0) {
        toast.warning("Todos os cards já existem na lista!");
        setIsImporting(false);
        return;
      }

      const duplicateCount = parsed.length - uniqueCards.length;
      if (duplicateCount > 0) {
        toast.info(`${duplicateCount} cards duplicados ignorados`);
      }

      // Prepare cards for insertion
      const cardsToInsert = uniqueCards.map(card => ({
        list_id: selectedListId,
        user_id: userData.id,
        term: (card.en || "").replace(/\n/g, " ").trim(),
        translation: (card.pt || "").replace(/\n/g, " ").trim(),
        hint: card.detailedHint || card.shortObservation || null,
      }));

      // Insert in chunks
      const totalChunks = Math.ceil(cardsToInsert.length / CHUNK_SIZE);
      let insertedCount = 0;

      for (let i = 0; i < cardsToInsert.length; i += CHUNK_SIZE) {
        const chunk = cardsToInsert.slice(i, i + CHUNK_SIZE);
        const chunkNumber = Math.floor(i / CHUNK_SIZE) + 1;
        
        setProgressText(`Salvando bloco ${chunkNumber}/${totalChunks}...`);
        setProgress((chunkNumber / totalChunks) * 100);

        const { error } = await supabase
          .from("flashcards")
          .insert(chunk);

        if (error) {
          console.error("Chunk insert error:", error);
          throw new Error(`Erro no bloco ${chunkNumber}: ${error.message}`);
        }

        insertedCount += chunk.length;
      }

      setProgress(100);
      setProgressText("Concluído!");
      
      toast.success(`✅ ${insertedCount} cards importados com sucesso!`);
      setPastedText("");
      
      // Navigate to the list
      navigate(`/list/${selectedListId}`);
    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Erro ao importar cards");
    } finally {
      setIsImporting(false);
    }
  };

  const previewCount = pastedText.trim() ? parsePastedFlashcards(pastedText).length : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 pb-24">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Importação Global</h1>
            <p className="text-muted-foreground">
              Importe cards para qualquer lista sua
            </p>
          </div>
        </div>

        {/* Select List */}
        <Card className="p-6 mb-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="list-select" className="text-base font-semibold flex items-center gap-2 mb-2">
                <FileText className="h-5 w-5 text-primary" />
                Lista Destino
              </Label>
              <Select value={selectedListId} onValueChange={setSelectedListId} disabled={listsLoading}>
                <SelectTrigger id="list-select">
                  <SelectValue placeholder={listsLoading ? "Carregando..." : "Selecione uma lista"} />
                </SelectTrigger>
                <SelectContent>
                  {userLists.map((list: any) => (
                    <SelectItem key={list.id} value={list.id}>
                      {list.folders?.title ? `${list.folders.title} / ` : ""}{list.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {userLists.length === 0 && !listsLoading && (
                <p className="text-sm text-muted-foreground mt-2">
                  Você ainda não tem listas. Crie uma pasta e lista primeiro.
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Paste Area */}
        <Card className="p-6 mb-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="paste-area" className="text-base font-semibold flex items-center gap-2 mb-2">
                <Upload className="h-5 w-5 text-primary" />
                Cole o Texto
              </Label>
              <Textarea
                id="paste-area"
                placeholder={`Cole seus flashcards aqui no formato:

Termo / Tradução
Hello / Olá (cumprimento) [Usado para saudar alguém]
Good morning / Bom dia

Cada linha = um card`}
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                className="min-h-[200px] font-mono text-sm"
                disabled={isImporting}
              />
              {previewCount > 0 && (
                <p className="text-sm text-muted-foreground mt-2">
                  {previewCount} cards detectados
                </p>
              )}
            </div>
          </div>
        </Card>

        {/* Progress */}
        {isImporting && (
          <Card className="p-6 mb-6">
            <div className="space-y-3">
              <p className="text-sm font-medium">{progressText}</p>
              <Progress value={progress} className="h-2" />
            </div>
          </Card>
        )}

        {/* Import Button */}
        <Button
          onClick={handleImport}
          disabled={!pastedText.trim() || !selectedListId || isImporting}
          className="w-full h-12 text-lg"
        >
          {isImporting ? "Importando..." : `Importar ${previewCount > 0 ? `${previewCount} cards` : ""}`}
        </Button>

        {/* Format Instructions */}
        <Card className="p-6 mt-6 bg-muted/50">
          <h3 className="font-semibold mb-3">Formato Aceito</h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <p><strong>Básico:</strong> Termo / Tradução</p>
            <p><strong>Com observação:</strong> Termo / Tradução (observação curta)</p>
            <p><strong>Com dica:</strong> Termo / Tradução [dica detalhada]</p>
            <p><strong>Completo:</strong> Termo / Tradução (obs) [dica]</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
