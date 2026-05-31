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
import { Upload, CheckCircle2, AlertCircle, Copy, Lightbulb, ChevronDown, ChevronUp, ArrowLeftRight, BookOpen, Info, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import {
  parsePastedFlashcards,
  deduplicateFlashcards,
  parseGlossaryAndCards,
  deduplicateGlossary,
  FlashcardPair,
  GlossaryParsed,
  buildAIHelperPrompt,
  analyzeFlashcardDuplicates,
  type DuplicateInfo,
} from "@/lib/bulkImport";
import {
  convertFileToImportText,
  detectKindFromName,
  MAX_IMPORT_FILE_BYTES,
} from "@/lib/fileImport";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { parseLayeredInput, extractCamadasBlock, type LayeredGroup } from "@/features/cards/lib/layeredImport";
import { createLayeredCard } from "@/features/cards/lib/layeredCards";

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
  const [layeredGroups, setLayeredGroups] = useState<LayeredGroup[]>([]);
  const [sentenceWarnings, setSentenceWarnings] = useState<string[]>([]);
  const [singletonWarnings, setSingletonWarnings] = useState<string[]>([]);
  const [detectLayers, setDetectLayers] = useState<boolean>(FEATURE_FLAGS.layered_cards);
  const [stats, setStats] = useState({ valid: 0, incomplete: 0, duplicates: 0, withHints: 0, glossaryNew: 0, glossaryDuplicates: 0, layeredGroups: 0, layeredCards: 0 });
  const [loading, setLoading] = useState(false);
  const [showAIHelper, setShowAIHelper] = useState(false);
  const [invertAB, setInvertAB] = useState(false);
  const [importDuplicatesAnyway, setImportDuplicatesAnyway] = useState(false);
  const [duplicateInfos, setDuplicateInfos] = useState<DuplicateInfo[]>([]);
  const fileInputRef = (typeof window !== "undefined")
    ? (window as any).__bulkImportFileRef ?? ((window as any).__bulkImportFileRef = { current: null as HTMLInputElement | null })
    : { current: null };
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
  const editableReview = FEATURE_FLAGS.bulk_import_v2;

  // ── Recompute stats when preview/glossary edited inline (V2) ──
  const recomputeStats = (cards: FlashcardPair[], glossary: GlossaryParsed[]) => {
    const valid = cards.filter(p => (p.sideA && p.sideB) || (p.en && p.pt)).length;
    const incomplete = cards.filter(p => !((p.sideA && p.sideB) || (p.en && p.pt))).length;
    const withHints = cards.filter(p => p.detailedHint).length;
    setStats(s => ({ ...s, valid, incomplete, withHints, glossaryNew: glossary.length }));
  };

  const updateCard = (idx: number, field: "A" | "B", value: string) => {
    setPreview(prev => {
      const next = [...prev];
      const cur = { ...next[idx] };
      if (field === "A") {
        if (cur.sideA !== undefined || cur.en === undefined) cur.sideA = value;
        else cur.en = value;
      } else {
        if (cur.sideB !== undefined || cur.pt === undefined) cur.sideB = value;
        else cur.pt = value;
      }
      next[idx] = cur;
      recomputeStats(next, glossaryPreview);
      return next;
    });
  };

  const removeCard = (idx: number) => {
    setPreview(prev => {
      const next = prev.filter((_, i) => i !== idx);
      recomputeStats(next, glossaryPreview);
      return next;
    });
  };

  const updateGlossary = (idx: number, field: "orig" | "trans", value: string) => {
    setGlossaryPreview(prev => {
      const next = [...prev];
      next[idx] = {
        ...next[idx],
        original_text: field === "orig" ? value : next[idx].original_text,
        translated_text: field === "trans" ? value : next[idx].translated_text,
      };
      recomputeStats(preview, next);
      return next;
    });
  };

  const removeGlossary = (idx: number) => {
    setGlossaryPreview(prev => {
      const next = prev.filter((_, i) => i !== idx);
      recomputeStats(preview, next);
      return next;
    });
  };

  const handleParse = () => {
    if (!input.trim()) {
      toast.error("Cole o conteúdo dos flashcards");
      return;
    }

    // ── PERF: Defer heavy parse to next frame to avoid input freeze ──
    setIsParsing(true);
    requestAnimationFrame(() => {
      setTimeout(() => {
        // ── Layered detection ──
        // Priority 1: explicit `[CAMADAS]` block (works inside or outside the
        // `=== CARDS ===` section). Lines in the block become layered cards;
        // the rest of the input falls through to the normal flat parser.
        //
        // Priority 2 (legacy fallback, only when no explicit block found):
        // implicit indentation / repeated-term heuristic via parseLayeredInput.
        let textForFlatParse = input;
        let detectedGroups: LayeredGroup[] = [];
        let warnings: string[] = [];
        let singletons: string[] = [];
        if (FEATURE_FLAGS.layered_cards && detectLayers) {
          const camadas = extractCamadasBlock(input);
          if (camadas.found) {
            detectedGroups = camadas.groups;
            warnings = camadas.sentenceWarnings;
            singletons = camadas.singletonWarnings;
            textForFlatParse = camadas.cleanedInput;
          } else {
            const cardsSectionMatch = input.match(/===\s*CARDS\s*===([\s\S]*)$/i);
            const layeredSource = cardsSectionMatch ? cardsSectionMatch[1] : input;
            const layered = parseLayeredInput(layeredSource);
            detectedGroups = layered.groups;
            if (detectedGroups.length > 0) {
              const leftoverText = layered.leftover.join("\n");
              textForFlatParse = cardsSectionMatch
                ? input.replace(cardsSectionMatch[1], "\n" + leftoverText)
                : leftoverText;
            }
          }
        }
        const { glossaryLines, cards } = parseGlossaryAndCards(textForFlatParse);
        const uniqueGlossary = deduplicateGlossary(glossaryLines, existingGlossary);
        const glossaryDuplicates = glossaryLines.length - uniqueGlossary.length;
        const deduplicated = deduplicateFlashcards(cards, existingCards);
        const valid = deduplicated.filter(p => (p.sideA && p.sideB) || (p.en && p.pt)).length;
        const incomplete = deduplicated.filter(p => !((p.sideA && p.sideB) || (p.en && p.pt))).length;
        const duplicates = cards.length - deduplicated.length;
        const withHints = deduplicated.filter(p => p.detailedHint).length;
        const layeredCards = detectedGroups.reduce((s, g) => s + g.layers.length, 0);

        setGlossaryPreview(uniqueGlossary);
        setPreview(deduplicated);
        setLayeredGroups(detectedGroups);
        setSentenceWarnings(warnings);
        setSingletonWarnings(singletons);
        setStats({ valid, incomplete, duplicates, withHints, glossaryNew: uniqueGlossary.length, glossaryDuplicates, layeredGroups: detectedGroups.length, layeredCards });
        setIsParsing(false);
      }, 0);
    });
  };

  const handleImport = async () => {
    const validPairs = preview.filter(p => (p.sideA && p.sideB) || (p.en && p.pt));

    if (validPairs.length === 0 && glossaryPreview.length === 0 && layeredGroups.length === 0) {
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
      // ── Layered groups first (additive; never touches existing cards) ──
      if (FEATURE_FLAGS.layered_cards && layeredGroups.length > 0) {
        for (const group of layeredGroups) {
          // Respect invertAB: each layer carries its own side-A / side-B,
          // so we swap them per layer. The group title stays the same
          // (it is only a visual container, not a playable card).
          const effectiveGroup: LayeredGroup = invertAB
            ? {
                term: group.term,
                layers: group.layers.map((L) => ({
                  ...L,
                  term: L.translation,
                  translation: L.term ?? group.term,
                })),
              }
            : group;
          try {
            await createLayeredCard({ listId: collectionId, userId: user.id, group: effectiveGroup });
          } catch (e: any) {
            console.error("Layered insert error:", e);
            toast.error("Erro ao importar cards em camadas: " + (e?.message ?? "desconhecido"));
            setLoading(false);
            return;
          }
        }
      }

      if (glossaryPreview.length > 0) {
        const glossaryRows = glossaryPreview.map(g => ({
          list_id: collectionId,
          original_text: invertAB ? g.translated_text : g.original_text,
          translated_text: invertAB ? g.original_text : g.translated_text,
          side: "A" as const,
          is_active: true,
        }));

        // Chunked insert to avoid blocking main thread
        const CHUNK = 50;
        for (let i = 0; i < glossaryRows.length; i += CHUNK) {
          const chunk = glossaryRows.slice(i, i + CHUNK);
          const { error: glossaryError } = await supabase
            .from("list_glossary")
            .insert(chunk as any);

          if (glossaryError) {
            console.error("Glossary insert error:", glossaryError);
            toast.error("Erro ao importar glossário: " + glossaryError.message);
            setLoading(false);
            return;
          }
          // Yield to main thread between chunks
          if (i + CHUNK < glossaryRows.length) {
            await new Promise(r => setTimeout(r, 0));
          }
        }
      }

      if (validPairs.length > 0) {
        const flashcards = validPairs.map(pair => {
          const termValue = pair.sideA || pair.en || '';
          const transValue = pair.sideB || pair.pt || '';
          // shortObservation comes from "(...)" on the RIGHT of the separator,
          // i.e. it belongs to sideB. After invertAB, sideB content becomes
          // `term` (side A), so the observation must follow to accepted_answers_en.
          // Convention (see WriteStudyView): _en = side A (term), _pt = side B (translation).
          const obs = pair.shortObservation ? [pair.shortObservation] : [];
          return {
            list_id: collectionId,
            user_id: user.id,
            term: invertAB ? transValue : termValue,
            translation: invertAB ? termValue : transValue,
            hint: pair.detailedHint || null,
            accepted_answers_en: invertAB ? obs : [],
            accepted_answers_pt: invertAB ? [] : obs,
          };
        });

        // Chunked insert to avoid blocking main thread
        const CHUNK = 50;
        for (let i = 0; i < flashcards.length; i += CHUNK) {
          const chunk = flashcards.slice(i, i + CHUNK);
          const { error } = await supabase.from("flashcards").insert(chunk);

          if (error) {
            toast.error("Erro ao importar flashcards");
            console.error(error);
            setLoading(false);
            return;
          }
          if (i + CHUNK < flashcards.length) {
            await new Promise(r => setTimeout(r, 0));
          }
        }
      }

      const parts: string[] = [];
      if (validPairs.length > 0) parts.push(`${validPairs.length} cards`);
      if (layeredGroups.length > 0) parts.push(`${layeredGroups.length} cards em camadas (${stats.layeredCards})`);
      if (glossaryPreview.length > 0) parts.push(`${glossaryPreview.length} termos no glossário`);
      toast.success(`✅ Importados: ${parts.join(" + ")}!`);
      
      setInput("");
      setPreview([]);
      setGlossaryPreview([]);
      setLayeredGroups([]);
      setSentenceWarnings([]);
      setSingletonWarnings([]);
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

  const totalImportable = stats.valid + stats.glossaryNew + stats.layeredCards;

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
                  <p className="font-medium">A IA gera uma seção CARDS, com bloco [CAMADAS] opcional:</p>
                  <div className="bg-background p-2 rounded text-xs font-mono space-y-1">
                    <p className="text-primary font-semibold">=== CARDS ===</p>
                    <p>house / casa</p>
                    <p>I study English every day / Eu estudo inglês todos os dias.</p>
                    <p className="text-primary font-semibold mt-2">[CAMADAS]</p>
                    <p>work / trabalhar</p>
                    <p>work / funcionar</p>
                    <p>look up / pesquisar</p>
                  </div>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 text-xs">
                    <li><strong>Cards normais:</strong> palavras ou frases comuns → ficam acima do bloco [CAMADAS].</li>
                    <li><strong>[CAMADAS]:</strong> palavras curtas / verbos frasais com múltiplos sentidos → o sistema agrupa termos repetidos em um único card com várias camadas.</li>
                    <li>O bloco [CAMADAS] é opcional. Sem ele, tudo continua sendo importado como card normal (compatível com formato antigo).</li>
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
              • Só cards: <code>{resolvedLabelA} / {resolvedLabelB} (obs) [dica]</code><br />
              • Bloco opcional <code>[CAMADAS]</code> dentro de CARDS: agrupa <strong>frases</strong> sob um termo principal (o termo é só o título do grupo; as frases viram os cards jogáveis).
            </p>
            <div className="rounded-md bg-muted/40 border border-border/60 p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong>Padrão:</strong> cole apenas cards normais. Glossário, dicas detalhadas e camadas são opcionais — só inclua se realmente precisar deles.
              </p>
            </div>
            <Textarea
              id="bulk-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`=== CARDS ===
house / casa
dog / cachorro

[CAMADAS]
look up
I looked up the word online / Eu pesquisei a palavra online
Things are finally looking up / As coisas finalmente estão melhorando
She looks up to her older brother / Ela admira o irmão mais velho

take off
The plane took off at 8 a.m. / O avião decolou às 8 da manhã
Please take off your shoes / Por favor, tire os sapatos
His business took off last year / O negócio dele decolou no ano passado`}
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <Button onClick={handleParse} variant="secondary" className="w-full" disabled={isParsing}>
            {isParsing ? "Processando..." : "Pré-visualizar"}
          </Button>

          {FEATURE_FLAGS.layered_cards && (
            <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <Label htmlFor="detect-layers" className="text-sm font-medium cursor-pointer">
                    Detectar camadas automaticamente
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Agrupa termos repetidos ou indentados como camadas de um mesmo card.
                  </p>
                </div>
              </div>
              <Switch id="detect-layers" checked={detectLayers} onCheckedChange={setDetectLayers} />
            </div>
          )}

          {(preview.length > 0 || glossaryPreview.length > 0 || layeredGroups.length > 0) && (
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
                  {stats.layeredGroups > 0 && (
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-primary" />
                      <span>
                        {stats.layeredGroups} card{stats.layeredGroups !== 1 ? "s" : ""} principal
                        {stats.layeredGroups !== 1 ? "is" : ""} com {stats.layeredCards} camada{stats.layeredCards !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
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
                  {sentenceWarnings.length > 0 && (
                    <div className="flex items-start gap-2 text-warning">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <p className="font-medium">
                          {sentenceWarnings.length} linha{sentenceWarnings.length !== 1 ? "s" : ""} dentro de [CAMADAS] parece{sentenceWarnings.length !== 1 ? "m" : ""} frase completa.
                        </p>
                        <p className="opacity-80">Recomenda-se mover para cards normais (acima do bloco [CAMADAS]).</p>
                      </div>
                    </div>
                  )}
                  {singletonWarnings.length > 0 && (
                    <div className="flex items-start gap-2 text-warning">
                      <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                      <div className="text-xs">
                        <p className="font-medium">
                          {singletonWarnings.length} termo{singletonWarnings.length !== 1 ? "s" : ""} em [CAMADAS] com apenas 1 tradução foi movido para cards normais.
                        </p>
                        <p className="opacity-80">
                          Um card em camadas exige pelo menos 2 traduções para o mesmo termo
                          ({singletonWarnings.slice(0, 5).join(", ")}{singletonWarnings.length > 5 ? "…" : ""}).
                        </p>
                      </div>
                    </div>
                  )}
                </AlertDescription>
              </Alert>

              {/* Glossary Preview */}
              {glossaryPreview.length > 0 && (
                <></>
              )}
              {layeredGroups.length > 0 && (
                <div className="border rounded-lg p-4 max-h-60 overflow-y-auto bg-primary/5">
                  <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Cards em camadas ({layeredGroups.length})
                  </h4>
                  <ul className="space-y-2 text-sm">
                    {layeredGroups.slice(0, 10).map((g, i) => (
                      <li key={i} className="border-l-2 border-primary/40 pl-2">
                        <div className="font-medium">
                          {g.term}
                          <span className="ml-2 text-[10px] text-muted-foreground font-normal">
                            grupo (não jogável)
                          </span>
                        </div>
                        <ul className="ml-2 text-xs text-muted-foreground space-y-0.5">
                          {g.layers.map((L, j) => (
                            <li key={j} className="truncate">
                              <span className="text-foreground">{j + 1}.</span> {L.term ?? g.term} <span className="opacity-60">/</span> {L.translation}
                              {L.example ? <span className="opacity-70"> — {L.example}</span> : null}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                    {layeredGroups.length > 10 && (
                      <li className="text-muted-foreground italic">
                        ...e mais {layeredGroups.length - 10}
                      </li>
                    )}
                  </ul>
                </div>
              )}
              {glossaryPreview.length > 0 && (
                <div className="border rounded-lg p-4 max-h-40 overflow-y-auto">
                  <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-primary" />
                    Glossário ({glossaryPreview.length} termos)
                    {editableReview && (
                      <span className="ml-auto text-[10px] text-muted-foreground font-normal flex items-center gap-1">
                        <Pencil className="h-3 w-3" /> editável
                      </span>
                    )}
                  </h4>
                  <ul className="space-y-1.5 text-sm">
                    {glossaryPreview.slice(0, 15).map((g, idx) => {
                      const origDisplay = invertAB ? g.translated_text : g.original_text;
                      const transDisplay = invertAB ? g.original_text : g.translated_text;
                      return (
                        <li key={idx} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-1 md:gap-2 items-center">
                          <span className="font-medium break-words flex items-center gap-1.5 min-w-0">
                            <SideBadge side="A" label={effectiveLabelA} lang={effectiveLangA} />
                            {editableReview ? (
                              <Input
                                value={origDisplay}
                                onChange={(e) =>
                                  updateGlossary(idx, invertAB ? "trans" : "orig", e.target.value)
                                }
                                className="h-7 text-xs"
                              />
                            ) : (
                              <span className="truncate">{origDisplay}</span>
                            )}
                          </span>
                          <span className="text-muted-foreground break-words flex items-center gap-1.5 min-w-0">
                            <SideBadge side="B" label={effectiveLabelB} lang={effectiveLangB} />
                            {editableReview ? (
                              <Input
                                value={transDisplay}
                                onChange={(e) =>
                                  updateGlossary(idx, invertAB ? "orig" : "trans", e.target.value)
                                }
                                className="h-7 text-xs"
                              />
                            ) : (
                              <span className="truncate">{transDisplay}</span>
                            )}
                          </span>
                          {editableReview && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 shrink-0"
                              onClick={() => removeGlossary(idx)}
                              aria-label="Remover termo"
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                          )}
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
                  <h4 className="font-semibold mb-2 text-sm flex items-center gap-2">
                    <span>Cards ({stats.valid} válidos)</span>
                    {editableReview && (
                      <span className="ml-auto text-[10px] text-muted-foreground font-normal flex items-center gap-1">
                        <Pencil className="h-3 w-3" /> editável
                      </span>
                    )}
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
                          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-1 md:gap-2 items-center">
                            <span className="font-medium break-words flex items-center gap-1.5 min-w-0">
                              <SideBadge side="A" label={effectiveLabelA} lang={effectiveLangA} />
                              {editableReview ? (
                                <Input
                                  value={termText === '?' ? '' : termText}
                                  onChange={(e) =>
                                    updateCard(idx, invertAB ? "B" : "A", e.target.value)
                                  }
                                  className="h-7 text-xs"
                                />
                              ) : (
                                <span className="truncate">{termText}</span>
                              )}
                            </span>
                            <span className="text-muted-foreground break-words flex items-center gap-1.5 min-w-0">
                              <SideBadge side="B" label={effectiveLabelB} lang={effectiveLangB} />
                              {editableReview ? (
                                <Input
                                  value={transText === '?' ? '' : transText}
                                  onChange={(e) =>
                                    updateCard(idx, invertAB ? "A" : "B", e.target.value)
                                  }
                                  className="h-7 text-xs"
                                />
                              ) : (
                                <span className="truncate">{transText}</span>
                              )}
                            </span>
                            {editableReview && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 shrink-0"
                                onClick={() => removeCard(idx)}
                                aria-label="Remover card"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </Button>
                            )}
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