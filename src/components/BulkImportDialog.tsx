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
import { Switch } from "@/components/ui/switch";
import { Upload, CheckCircle2, AlertCircle, Copy, Lightbulb, ChevronDown, ChevronUp, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { parsePastedFlashcards, deduplicateFlashcards, FlashcardPair, AI_HELPER_PROMPT } from "@/lib/bulkImport";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface BulkImportDialogProps {
  collectionId: string;
  existingCards: { term: string; translation: string }[];
  onImported: () => void;
  labelA?: string;
  labelB?: string;
}

export const BulkImportDialog = ({
  collectionId,
  existingCards,
  onImported,
  labelA = "Lado A",
  labelB = "Lado B",
}: BulkImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<FlashcardPair[]>([]);
  const [stats, setStats] = useState({ valid: 0, incomplete: 0, duplicates: 0, withHints: 0 });
  const [loading, setLoading] = useState(false);
  const [showAIHelper, setShowAIHelper] = useState(false);
  const [invertAB, setInvertAB] = useState(false);

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
    const withHints = deduplicated.filter(p => p.detailedHint).length;

    setPreview(deduplicated);
    setStats({ valid, incomplete, duplicates, withHints });
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

    // Apply swap logic: if invertAB is true, swap term and translation
    const flashcards = validPairs.map(pair => ({
      list_id: collectionId,
      user_id: user.id,
      term: invertAB ? pair.en! : pair.pt!,
      translation: invertAB ? pair.pt! : pair.en!,
      hint: pair.detailedHint || null,
      accepted_answers_en: [],
      accepted_answers_pt: pair.shortObservation ? [pair.shortObservation] : [],
    }));

    const { error } = await supabase.from("flashcards").insert(flashcards);

    if (error) {
      toast.error("Erro ao importar flashcards");
      console.error(error);
    } else {
      toast.success(`${validPairs.length} flashcards importados!`);
      setInput("");
      setPreview([]);
      setInvertAB(false);
      setOpen(false);
      onImported();
    }

    setLoading(false);
  };

  const handleCopyAIPrompt = () => {
    navigator.clipboard.writeText(AI_HELPER_PROMPT);
    toast.success("Prompt copiado para a área de transferência!");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="mr-2 h-4 w-4" />
          Importar por Colagem
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Importar Flashcards em Lote</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* AI Helper Section */}
          <Collapsible open={showAIHelper} onOpenChange={setShowAIHelper}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-warning" />
                  Ajuda com IA (gerar cards automaticamente)
                </span>
                {showAIHelper ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="text-sm space-y-2">
                  <p className="font-medium">Formato dos cards (uma linha por card):</p>
                  <code className="block bg-background p-2 rounded text-xs">
                    INGLÊS / PORTUGUÊS (observação curta opcional) [descrição detalhada opcional]
                  </code>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
                    <li>Tudo antes da barra <code>/</code> é o termo em inglês.</li>
                    <li>Tudo depois da barra <code>/</code> é a tradução principal em português.</li>
                    <li>O que estiver entre parênteses <code>( )</code> é só uma observação curta (não entra como resposta).</li>
                    <li>O que estiver entre colchetes <code>[ ]</code> é uma explicação detalhada que aparece na lâmpada de dica.</li>
                    <li>A IA NÃO deve inventar observações ou descrições se você não pedir.</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Prompt para copiar e usar com ChatGPT/Claude:</Label>
                  <Textarea
                    value={AI_HELPER_PROMPT}
                    readOnly
                    rows={8}
                    className="font-mono text-xs bg-background resize-none"
                  />
                  <Button onClick={handleCopyAIPrompt} variant="secondary" size="sm" className="w-full">
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar prompt para IA
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="space-y-2">
            <Label htmlFor="bulk-input">
              Cole os flashcards (um por linha)
            </Label>
            <p className="text-sm text-muted-foreground">
              Formatos aceitos:<br />
              • <code>{labelA} / {labelB}</code><br />
              • <code>{labelA} / {labelB} (observação) [dica detalhada]</code><br />
              • Frases únicas (auto-detecta idioma)
            </p>
            <Textarea
              id="bulk-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`I am / Eu sou (pode significar "estou") [Usado para falar de identidade]
She is happy / Ela está feliz [Estado emocional temporário]
Hello / Olá`}
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <Button onClick={handleParse} variant="secondary" className="w-full">
            Pré-visualizar
          </Button>

          {preview.length > 0 && (
            <>
              {/* Invert A/B Switch */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="invert-ab" className="text-sm font-medium cursor-pointer">
                      Inverter Lados (A ↔ B)
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {invertAB 
                        ? `${labelB} → termo, ${labelA} → tradução`
                        : `${labelA} → termo, ${labelB} → tradução`
                      }
                    </p>
                  </div>
                </div>
                <Switch
                  id="invert-ab"
                  checked={invertAB}
                  onCheckedChange={setInvertAB}
                />
              </div>

              <Alert>
                <AlertDescription className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>{stats.valid} válidos</span>
                  </div>
                  {stats.withHints > 0 && (
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-warning" />
                      <span>{stats.withHints} com dica detalhada</span>
                    </div>
                  )}
                  {stats.incomplete > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-warning" />
                      <span>{stats.incomplete} incompletos (serão ignorados)</span>
                    </div>
                  )}
                  {stats.duplicates > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-primary" />
                      <span>{stats.duplicates} duplicados (removidos)</span>
                    </div>
                  )}
                </AlertDescription>
              </Alert>

              <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                <h4 className="font-semibold mb-2 text-sm">
                  Pré-visualização ({invertAB ? "Invertido" : "Normal"}):
                </h4>
                <ul className="space-y-2 text-sm">
                  {preview.slice(0, 20).map((pair, idx) => {
                    const termText = invertAB ? pair.en : pair.pt;
                    const transText = invertAB ? pair.pt : pair.en;
                    return (
                      <li key={idx} className={`${!pair.en || !pair.pt ? "text-muted-foreground" : ""}`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2">
                          <span className="font-medium break-words">{termText || "?"}</span>
                          <span className="text-muted-foreground break-words">→ {transText || "?"}</span>
                        </div>
                        {pair.detailedHint && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Lightbulb className="h-3 w-3 shrink-0" />
                            <span className="truncate">{pair.detailedHint.substring(0, 50)}...</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
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
