import { useState, useMemo } from "react";
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
import { Upload, CheckCircle2, AlertCircle, Copy, Lightbulb, ChevronDown, ChevronUp, ArrowLeftRight, BookOpen, Info } from "lucide-react";
import { toast } from "sonner";
import {
  parsePastedFlashcards,
  deduplicateFlashcards,
  parseGlossaryAndCards,
  deduplicateGlossary,
  FlashcardPair,
  GlossaryParsed,
  buildAIHelperPrompt,
} from "@/lib/bulkImport";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

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

/** Resolves a human-readable side label with lang code fallback */
function resolveSideLabel(label: string | undefined, lang: string | undefined, fallback: string): string {
  if (label && label !== "Lado A" && label !== "Lado B") return label;
  if (lang) {
    const LANG_NAMES: Record<string, string> = {
      en: "English", pt: "Português", fr: "Français", es: "Español",
      de: "Deutsch", it: "Italiano", ja: "日本語", ko: "한국어",
      zh: "中文", ru: "Русский", ar: "العربية", hi: "हिन्दी",
    };
    return LANG_NAMES[lang] || lang.toUpperCase();
  }
  return fallback;
}

/** Side badge component for consistent labeling */
function SideBadge({ side, label, lang }: { side: "A" | "B"; label: string; lang?: string }) {
  const langSuffix = lang ? ` (${lang})` : "";
  return (
    <Badge
      variant={side === "A" ? "default" : "secondary"}
      className="text-[10px] px-1.5 py-0 shrink-0 font-semibold"
    >
      {side} • {label}{langSuffix}
    </Badge>
  );
}

export const BulkImportDialog = ({
  collectionId,
  existingCards,
  existingGlossary = [],
  onImported,
  labelA: rawLabelA = "Lado A",
  labelB: rawLabelB = "Lado B",
  langA,
  langB,
}: BulkImportDialogProps) => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<FlashcardPair[]>([]);
  const [glossaryPreview, setGlossaryPreview] = useState<GlossaryParsed[]>([]);
  const [stats, setStats] = useState({ valid: 0, incomplete: 0, duplicates: 0, withHints: 0, glossaryNew: 0, glossaryDuplicates: 0 });
  const [loading, setLoading] = useState(false);
  const [showAIHelper, setShowAIHelper] = useState(false);
  const [invertAB, setInvertAB] = useState(false);
  const queryClient = useQueryClient();
  const aiPrompt = useMemo(() => buildAIHelperPrompt(langA, langB), [langA, langB]);

  // Resolved labels with proper fallback
  const resolvedLabelA = resolveSideLabel(rawLabelA, langA, "Lado A");
  const resolvedLabelB = resolveSideLabel(rawLabelB, langB, "Lado B");

  // Effective labels considering inversion
  const effectiveLabelA = invertAB ? resolvedLabelB : resolvedLabelA;
  const effectiveLabelB = invertAB ? resolvedLabelA : resolvedLabelB;
  const effectiveLangA = invertAB ? langB : langA;
  const effectiveLangB = invertAB ? langA : langB;

  const [isParsing, setIsParsing] = useState(false);

  const handleParse = () => {
    if (!input.trim()) {
      toast.error("Cole o conteúdo dos flashcards");
      return;
    }

    // ── PERF: Defer heavy parse to next frame to avoid input freeze ──
    setIsParsing(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        const { glossaryLines, cards } = parseGlossaryAndCards(input);
        const uniqueGlossary = deduplicateGlossary(glossaryLines, existingGlossary);
        const glossaryDuplicates = glossaryLines.length - uniqueGlossary.length;
        const deduplicated = deduplicateFlashcards(cards, existingCards);
        const valid = deduplicated.filter(p => (p.sideA && p.sideB) || (p.en && p.pt)).length;
        const incomplete = deduplicated.filter(p => !((p.sideA && p.sideB) || (p.en && p.pt))).length;
        const duplicates = cards.length - deduplicated.length;
        const withHints = deduplicated.filter(p => p.detailedHint).length;

        setGlossaryPreview(uniqueGlossary);
        setPreview(deduplicated);
        setStats({ valid, incomplete, duplicates, withHints, glossaryNew: uniqueGlossary.length, glossaryDuplicates });
        setIsParsing(false);
      }, 0);
    });
  };

  const handleImport = async () => {
    const validPairs = preview.filter(p => (p.sideA && p.sideB) || (p.en && p.pt));
    
    if (validPairs.length === 0 && glossaryPreview.length === 0) {
      toast.error("Nenhum item válido para importar");
      return;
    }

    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Você precisa estar logado");
      setLoading(false);
      return;
    }

    try {
      if (glossaryPreview.length > 0) {
        const glossaryRows = glossaryPreview.map(g => ({
          list_id: collectionId,
          original_text: invertAB ? g.translated_text : g.original_text,
          translated_text: invertAB ? g.original_text : g.translated_text,
          side: "A" as const,
          is_active: true,
        }));

        const { error: glossaryError } = await supabase
          .from("list_glossary")
          .insert(glossaryRows as any);

        if (glossaryError) {
          console.error("Glossary insert error:", glossaryError);
          toast.error("Erro ao importar glossário: " + glossaryError.message);
          setLoading(false);
          return;
        }
      }

      if (validPairs.length > 0) {
        const flashcards = validPairs.map(pair => {
          const termValue = pair.sideA || pair.en || '';
          const transValue = pair.sideB || pair.pt || '';
          return {
            list_id: collectionId,
            user_id: user.id,
            term: invertAB ? transValue : termValue,
            translation: invertAB ? termValue : transValue,
            hint: pair.detailedHint || null,
            accepted_answers_en: [],
            accepted_answers_pt: pair.shortObservation ? [pair.shortObservation] : [],
          };
        });

        const { error } = await supabase.from("flashcards").insert(flashcards);

        if (error) {
          toast.error("Erro ao importar flashcards");
          console.error(error);
          setLoading(false);
          return;
        }
      }

      const parts: string[] = [];
      if (validPairs.length > 0) parts.push(`${validPairs.length} cards`);
      if (glossaryPreview.length > 0) parts.push(`${glossaryPreview.length} termos no glossário`);
      toast.success(`✅ Importados: ${parts.join(" + ")}!`);
      
      setInput("");
      setPreview([]);
      setGlossaryPreview([]);
      setInvertAB(false);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["list-glossary", collectionId] });
      onImported();
    } catch (err: any) {
      toast.error(err.message || "Erro ao importar");
    }

    setLoading(false);
  };

  const handleCopyAIPrompt = () => {
    navigator.clipboard.writeText(aiPrompt);
    toast.success("Prompt copiado para a área de transferência!");
  };

  const totalImportable = stats.valid + stats.glossaryNew;

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
                  Ajuda com IA (gerar cards + glossário)
                </span>
                {showAIHelper ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-3">
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="text-sm space-y-2">
                  <p className="font-medium">A IA gera duas seções automaticamente:</p>
                  <div className="bg-background p-2 rounded text-xs font-mono space-y-1">
                    <p className="text-primary font-semibold">=== GLOSSÁRIO GLOBAL ===</p>
                    <p>work / trabalhar</p>
                    <p>late / atrasado</p>
                    <p className="text-primary font-semibold mt-2">=== CARDS ===</p>
                    <p>I work today / Eu trabalho hoje</p>
                    <p>She is late / Ela está atrasada (informal) [Dica detalhada]</p>
                  </div>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
                    <li><strong>Glossário:</strong> palavras soltas com tradução direta → ficam nas traduções globais da lista.</li>
                    <li><strong>Cards:</strong> frases completas → ficam como flashcards de estudo.</li>
                    <li>Você também pode colar <strong>só cards</strong> sem glossário (compatível com formato antigo).</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Prompt para copiar e usar com ChatGPT/Claude:</Label>
                  <Textarea
                    value={aiPrompt}
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
              Cole o conteúdo (glossário + cards ou só cards)
            </Label>
            <p className="text-sm text-muted-foreground">
              Formatos aceitos:<br />
              • Duas seções: <code>=== GLOSSÁRIO GLOBAL ===</code> + <code>=== CARDS ===</code><br />
              • Só cards: <code>{resolvedLabelA} / {resolvedLabelB} (obs) [dica]</code>
            </p>
            <Textarea
              id="bulk-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`=== GLOSSÁRIO GLOBAL ===
work / trabalhar
late / atrasado

=== CARDS ===
I work today / Eu trabalho hoje
She is late / Ela está atrasada (informal)`}
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <Button onClick={handleParse} variant="secondary" className="w-full">
            Pré-visualizar
          </Button>

          {(preview.length > 0 || glossaryPreview.length > 0) && (
            <>
              {/* Column mapping header */}
              <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Tudo que aparecer na coluna A será salvo em <strong>term</strong> (lado A).
                    Tudo que aparecer na coluna B será salvo em <strong>translation</strong> (lado B).
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Coluna 1 =</span>
                    <SideBadge side="A" label={effectiveLabelA} lang={effectiveLangA} />
                  </div>
                  <span className="hidden sm:inline text-muted-foreground">→</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-medium">Coluna 2 =</span>
                    <SideBadge side="B" label={effectiveLabelB} lang={effectiveLangB} />
                  </div>
                </div>
              </div>

              {/* Invert A/B Switch */}
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <Label htmlFor="invert-ab" className="text-sm font-medium cursor-pointer">
                      Trocar conteúdo entre lados
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {invertAB 
                        ? `Invertido: A = ${effectiveLabelA}, B = ${effectiveLabelB}`
                        : `Original: A = ${effectiveLabelA}, B = ${effectiveLabelB}`
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
                  {stats.glossaryNew > 0 && (
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <span>{stats.glossaryNew} termos novos no glossário</span>
                    </div>
                  )}
                  {stats.glossaryDuplicates > 0 && (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-muted-foreground" />
                      <span>{stats.glossaryDuplicates} termos do glossário já existentes (ignorados)</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>{stats.valid} cards válidos</span>
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
                      <span>{stats.duplicates} cards duplicados (removidos)</span>
                    </div>
                  )}
                </AlertDescription>
              </Alert>

              {/* Glossary Preview */}
              {glossaryPreview.length > 0 && (
                <div className="border rounded-lg p-4 max-h-40 overflow-y-auto">
                  <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Glossário ({glossaryPreview.length} termos)
                  </h4>
                  <ul className="space-y-1.5 text-sm">
                    {glossaryPreview.slice(0, 15).map((g, idx) => {
                      const origDisplay = invertAB ? g.translated_text : g.original_text;
                      const transDisplay = invertAB ? g.original_text : g.translated_text;
                      return (
                        <li key={idx} className="grid grid-cols-1 md:grid-cols-2 gap-1">
                          <span className="font-medium break-words flex items-center gap-1.5">
                            <SideBadge side="A" label={effectiveLabelA} lang={effectiveLangA} />
                            <span className="truncate">{origDisplay}</span>
                          </span>
                          <span className="text-muted-foreground break-words flex items-center gap-1.5">
                            <SideBadge side="B" label={effectiveLabelB} lang={effectiveLangB} />
                            <span className="truncate">{transDisplay}</span>
                          </span>
                        </li>
                      );
                    })}
                    {glossaryPreview.length > 15 && (
                      <li className="text-muted-foreground italic">
                        ...e mais {glossaryPreview.length - 15}
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Cards Preview */}
              {preview.length > 0 && (
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto">
                  <h4 className="font-semibold mb-2 text-sm">
                    Cards ({stats.valid} válidos)
                  </h4>
                  <ul className="space-y-2 text-sm">
                    {preview.slice(0, 20).map((pair, idx) => {
                      const sideAVal = pair.sideA || pair.en || '?';
                      const sideBVal = pair.sideB || pair.pt || '?';
                      const termText = invertAB ? sideBVal : sideAVal;
                      const transText = invertAB ? sideAVal : sideBVal;
                      const isValid = (pair.sideA && pair.sideB) || (pair.en && pair.pt);
                      return (
                        <li key={idx} className={`${!isValid ? "text-muted-foreground" : ""}`}>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-1 md:gap-2">
                            <span className="font-medium break-words flex items-center gap-1.5">
                              <SideBadge side="A" label={effectiveLabelA} lang={effectiveLangA} />
                              <span className="truncate">{termText}</span>
                            </span>
                            <span className="text-muted-foreground break-words flex items-center gap-1.5">
                              <SideBadge side="B" label={effectiveLabelB} lang={effectiveLangB} />
                              <span className="truncate">{transText}</span>
                            </span>
                          </div>
                          {pair.detailedHint && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 ml-1">
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
              )}

              {/* Final confirmation summary */}
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Você está prestes a salvar:
                </p>
                <div className="text-xs text-muted-foreground space-y-0.5 ml-6">
                  <p><strong>term</strong> (Lado A) = <span className="text-foreground font-medium">{effectiveLabelA}{effectiveLangA ? ` (${effectiveLangA})` : ""}</span></p>
                  <p><strong>translation</strong> (Lado B) = <span className="text-foreground font-medium">{effectiveLabelB}{effectiveLangB ? ` (${effectiveLangB})` : ""}</span></p>
                  {totalImportable > 0 && (
                    <p className="mt-1 text-foreground">{totalImportable} item{totalImportable !== 1 ? "s" : ""} será{totalImportable !== 1 ? "ão" : ""} importado{totalImportable !== 1 ? "s" : ""}</p>
                  )}
                </div>
              </div>

              <Button 
                onClick={handleImport} 
                disabled={loading || totalImportable === 0}
                className="w-full"
              >
                {loading ? "Importando..." : `Importar ${totalImportable} item${totalImportable !== 1 ? 's' : ''}`}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};