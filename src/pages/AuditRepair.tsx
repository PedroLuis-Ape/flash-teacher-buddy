import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ArrowLeft, Search, AlertTriangle, CheckCircle2, ArrowLeftRight,
  FileText, Settings, Eye, RotateCcw, Edit3, ChevronDown, ChevronUp,
  Shield, Loader2
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getLangLabel } from "@/features/study/lib/resolveStudySides";

// ── Types ──────────────────────────────────────────────────────────

interface LangScore {
  lang: string;
  score: number;
  confidence: "high" | "medium" | "low";
}

interface FlaggedCard {
  id: string;
  term: string;
  translation: string;
  detected_lang_term: LangScore | null;
  detected_lang_translation: LangScore | null;
  reason: string;
}

interface FlaggedList {
  list_id: string;
  list_title: string;
  folder_title: string | null;
  owner_id: string;
  lang_a: string | null;
  lang_b: string | null;
  labels_a: string | null;
  labels_b: string | null;
  study_type: string;
  total_cards: number;
  suspicious_cards: number;
  sample_cards: FlaggedCard[];
  reasons: string[];
}

interface AuditReport {
  success: boolean;
  total_lists_checked: number;
  total_suspicious_lists: number;
  total_cards_checked: number;
  total_suspicious_cards: number;
  flagged_lists: FlaggedList[];
}

// ── Sub-components ─────────────────────────────────────────────────

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const variant = confidence === "high" ? "destructive" : confidence === "medium" ? "default" : "secondary";
  return <Badge variant={variant} className="text-[10px] px-1.5 py-0">{confidence}</Badge>;
}

function LangDetectionTag({ detection, expected }: { detection: LangScore | null; expected: string }) {
  if (!detection) return <span className="text-xs text-muted-foreground italic">—</span>;
  const mismatch = detection.lang !== expected && detection.confidence !== "low";
  return (
    <span className={`text-xs flex items-center gap-1 ${mismatch ? "text-destructive font-medium" : "text-muted-foreground"}`}>
      {getLangLabel(detection.lang)}
      <ConfidenceBadge confidence={detection.confidence} />
      {mismatch && <AlertTriangle className="h-3 w-3" />}
    </span>
  );
}

function CardRow({
  card,
  langA,
  langB,
  labelsA,
  labelsB,
  onSwap,
  onEdit,
  isRepairing,
}: {
  card: FlaggedCard;
  langA: string;
  langB: string;
  labelsA: string;
  labelsB: string;
  onSwap: (id: string) => void;
  onEdit: (id: string, term: string, translation: string) => void;
  isRepairing: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editTerm, setEditTerm] = useState(card.term);
  const [editTranslation, setEditTranslation] = useState(card.translation);

  const ttsLangA = langA || "en";
  const ttsLangB = langB || "pt";

  return (
    <div className="border rounded-lg p-3 space-y-2 bg-background">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Side A */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge className="text-[10px] px-1.5 py-0">A • {labelsA}</Badge>
            <span className="text-[10px] text-muted-foreground">TTS: {ttsLangA}</span>
          </div>
          {editing ? (
            <Input value={editTerm} onChange={(e) => setEditTerm(e.target.value)} className="text-sm" />
          ) : (
            <p className="text-sm font-medium break-words">{card.term}</p>
          )}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Detectado:</span>
            <LangDetectionTag detection={card.detected_lang_term} expected={ttsLangA} />
          </div>
        </div>

        {/* Side B */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">B • {labelsB}</Badge>
            <span className="text-[10px] text-muted-foreground">TTS: {ttsLangB}</span>
          </div>
          {editing ? (
            <Input value={editTranslation} onChange={(e) => setEditTranslation(e.target.value)} className="text-sm" />
          ) : (
            <p className="text-sm text-muted-foreground break-words">{card.translation}</p>
          )}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground">Detectado:</span>
            <LangDetectionTag detection={card.detected_lang_translation} expected={ttsLangB} />
          </div>
        </div>
      </div>

      {/* Reason */}
      <p className="text-xs text-warning flex items-center gap-1">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        {card.reason}
      </p>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={isRepairing}
          onClick={() => onSwap(card.id)}
          className="text-xs h-7"
        >
          <ArrowLeftRight className="h-3 w-3 mr-1" />
          Inverter A↔B
        </Button>

        {editing ? (
          <>
            <Button
              size="sm"
              variant="default"
              disabled={isRepairing}
              onClick={() => {
                onEdit(card.id, editTerm, editTranslation);
                setEditing(false);
              }}
              className="text-xs h-7"
            >
              Salvar
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditTerm(card.term);
                setEditTranslation(card.translation);
                setEditing(false);
              }}
              className="text-xs h-7"
            >
              Cancelar
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
            className="text-xs h-7"
          >
            <Edit3 className="h-3 w-3 mr-1" />
            Editar
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────

export default function AuditRepair() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [repairing, setRepairing] = useState<Record<string, boolean>>({});
  const [expandedLists, setExpandedLists] = useState<Set<string>>(new Set());
  const [resolvedLists, setResolvedLists] = useState<Set<string>>(new Set());

  const runAudit = useCallback(async () => {
    setLoading(true);
    setReport(null);
    setResolvedLists(new Set());

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado");
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke("audit-ab-consistency", {
        body: { max_sample: 10 },
      });

      if (error) throw error;
      setReport(data as AuditReport);

      if (data.total_suspicious_lists === 0) {
        toast.success("Nenhuma inconsistência encontrada! ✅");
      } else {
        toast.warning(`${data.total_suspicious_lists} lista(s) com possíveis problemas`);
      }
    } catch (err: any) {
      console.error("Audit error:", err);
      toast.error(err.message || "Erro ao executar auditoria");
    } finally {
      setLoading(false);
    }
  }, []);

  const invokeRepair = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("repair-ab", { body });
    if (error) throw error;
    return data;
  };

  const handleSwapCards = async (listId: string, cardIds: string[]) => {
    setRepairing((p) => ({ ...p, [listId]: true }));
    try {
      await invokeRepair({ action: "swap_cards", list_id: listId, card_ids: cardIds });
      toast.success(`${cardIds.length} card(s) invertido(s)`);
    } catch (err: any) {
      toast.error(err.message || "Erro ao inverter cards");
    } finally {
      setRepairing((p) => ({ ...p, [listId]: false }));
    }
  };

  const handleEditCard = async (listId: string, cardId: string, newTerm: string, newTranslation: string) => {
    setRepairing((p) => ({ ...p, [listId]: true }));
    try {
      await invokeRepair({ action: "edit_card", list_id: listId, card_id: cardId, new_term: newTerm, new_translation: newTranslation });
      toast.success("Card atualizado");
    } catch (err: any) {
      toast.error(err.message || "Erro ao editar card");
    } finally {
      setRepairing((p) => ({ ...p, [listId]: false }));
    }
  };

  const handleFixMetadata = async (listId: string) => {
    setRepairing((p) => ({ ...p, [listId]: true }));
    try {
      await invokeRepair({ action: "fix_metadata", list_id: listId });
      toast.success("Metadados da lista invertidos");
      setResolvedLists((p) => new Set(p).add(listId));
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally {
      setRepairing((p) => ({ ...p, [listId]: false }));
    }
  };

  const handleFullRepair = async (listId: string) => {
    setRepairing((p) => ({ ...p, [listId]: true }));
    try {
      const result = await invokeRepair({ action: "full_repair", list_id: listId });
      toast.success(result.message || "Reparo completo aplicado");
      setResolvedLists((p) => new Set(p).add(listId));
    } catch (err: any) {
      toast.error(err.message || "Erro");
    } finally {
      setRepairing((p) => ({ ...p, [listId]: false }));
    }
  };

  const handleMarkReviewed = async (listId: string) => {
    try {
      await invokeRepair({ action: "mark_reviewed", list_id: listId });
      toast.success("Marcada como revisada");
      setResolvedLists((p) => new Set(p).add(listId));
    } catch {
      toast.error("Erro ao marcar");
    }
  };

  const handleSwapAllFlagged = async (listId: string, cardIds: string[]) => {
    await handleSwapCards(listId, cardIds);
  };

  const toggleExpanded = (listId: string) => {
    setExpandedLists((prev) => {
      const next = new Set(prev);
      if (next.has(listId)) next.delete(listId);
      else next.add(listId);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 pb-24">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              Auditoria A/B
            </h1>
            <p className="text-sm text-muted-foreground">
              Diagnosticar e reparar inconsistências de idioma nos flashcards
            </p>
          </div>
        </div>

        {/* Run Audit */}
        <Card className="p-6 mb-6">
          <div className="space-y-3">
            <h2 className="font-semibold flex items-center gap-2">
              <Search className="h-4 w-4 text-primary" />
              Executar Auditoria
            </h2>
            <p className="text-sm text-muted-foreground">
              Analisa todas as suas listas de idiomas e detecta cards onde o conteúdo pode estar no lado errado
              (ex.: texto em inglês salvo como "Lado A" quando o label diz Português).
              Nenhuma alteração é feita automaticamente — tudo é preview primeiro.
            </p>
            <Button onClick={runAudit} disabled={loading} className="w-full sm:w-auto">
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Iniciar Auditoria
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Report Summary */}
        {report && (
          <Card className="p-6 mb-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Relatório
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{report.total_lists_checked}</p>
                <p className="text-xs text-muted-foreground">Listas verificadas</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className={`text-2xl font-bold ${report.total_suspicious_lists > 0 ? "text-warning" : "text-success"}`}>
                  {report.total_suspicious_lists}
                </p>
                <p className="text-xs text-muted-foreground">Listas suspeitas</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{report.total_cards_checked}</p>
                <p className="text-xs text-muted-foreground">Cards verificados</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className={`text-2xl font-bold ${report.total_suspicious_cards > 0 ? "text-warning" : "text-success"}`}>
                  {report.total_suspicious_cards}
                </p>
                <p className="text-xs text-muted-foreground">Cards suspeitos</p>
              </div>
            </div>

            {report.total_suspicious_lists === 0 && (
              <Alert className="mt-4">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <AlertDescription>
                  Todas as listas estão consistentes! Nenhuma ação necessária.
                </AlertDescription>
              </Alert>
            )}
          </Card>
        )}

        {/* Flagged Lists */}
        {report && report.flagged_lists.length > 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-lg">
              Listas com Possíveis Inconsistências ({report.flagged_lists.length})
            </h2>

            {report.flagged_lists.map((list) => {
              const isExpanded = expandedLists.has(list.list_id);
              const isResolved = resolvedLists.has(list.list_id);
              const isListRepairing = repairing[list.list_id] || false;
              const labelsA = list.labels_a || getLangLabel(list.lang_a || "en");
              const labelsB = list.labels_b || getLangLabel(list.lang_b || "pt");

              return (
                <Card key={list.list_id} className={`p-4 space-y-3 ${isResolved ? "opacity-60" : ""}`}>
                  {/* List header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">
                        {list.folder_title && <span className="text-muted-foreground">{list.folder_title} / </span>}
                        {list.list_title}
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline" className="text-[10px]">A: {labelsA} ({list.lang_a})</Badge>
                        <Badge variant="outline" className="text-[10px]">B: {labelsB} ({list.lang_b})</Badge>
                        <Badge variant="secondary" className="text-[10px]">{list.total_cards} cards</Badge>
                        <Badge variant="destructive" className="text-[10px]">{list.suspicious_cards} suspeitos</Badge>
                      </div>
                      {list.reasons.map((r, i) => (
                        <p key={i} className="text-xs text-warning flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 shrink-0" /> {r}
                        </p>
                      ))}
                    </div>
                    {isResolved && (
                      <Badge className="text-[10px] bg-success text-success-foreground shrink-0">Resolvida</Badge>
                    )}
                  </div>

                  {/* TTS Info */}
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 space-y-0.5">
                    <p><strong>TTS Lado A:</strong> voz {list.lang_a || "en"} → reproduz o conteúdo de <em>term</em></p>
                    <p><strong>TTS Lado B:</strong> voz {list.lang_b || "pt"} → reproduz o conteúdo de <em>translation</em></p>
                    <p className="text-warning">Se o conteúdo estiver invertido, o TTS fala o idioma errado.</p>
                  </div>

                  {/* List-level repair actions */}
                  {!isResolved && (
                    <div className="flex flex-wrap gap-2">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" disabled={isListRepairing} className="text-xs h-7">
                            <Settings className="h-3 w-3 mr-1" />
                            Corrigir metadados
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Corrigir apenas metadados?</AlertDialogTitle>
                            <AlertDialogDescription className="space-y-2">
                              <p>Isso vai trocar os campos da lista:</p>
                              <p><strong>lang_a</strong> ↔ <strong>lang_b</strong></p>
                              <p><strong>labels_a</strong> ↔ <strong>labels_b</strong></p>
                              <p>O conteúdo dos cards (term/translation) <strong>não será alterado</strong>.</p>
                              <p className="text-warning">Use quando os dados dos cards estão corretos, mas os rótulos da lista estão trocados.</p>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleFixMetadata(list.list_id)}>
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="outline" disabled={isListRepairing} className="text-xs h-7">
                            <ArrowLeftRight className="h-3 w-3 mr-1" />
                            Reparo completo
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reparo estrutural completo?</AlertDialogTitle>
                            <AlertDialogDescription className="space-y-2">
                              <p>Isso vai:</p>
                              <ul className="list-disc list-inside text-sm space-y-1">
                                <li>Trocar <strong>lang_a ↔ lang_b</strong> e <strong>labels_a ↔ labels_b</strong></li>
                                <li>Trocar <strong>term ↔ translation</strong> em <strong>todos os {list.total_cards} cards</strong></li>
                              </ul>
                              <p className="text-warning">Use quando tanto o conteúdo quanto os rótulos estão invertidos.</p>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleFullRepair(list.list_id)}>
                              Confirmar reparo completo
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkReviewed(list.list_id)}
                        className="text-xs h-7"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Sem problema
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => navigate(`/list/${list.list_id}`)}
                        className="text-xs h-7"
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        Abrir lista
                      </Button>
                    </div>
                  )}

                  {/* Expandable sample cards */}
                  <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(list.list_id)}>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="w-full justify-between text-xs h-7">
                        <span>
                          {isExpanded ? "Ocultar" : "Ver"} {list.sample_cards.length} cards suspeitos
                        </span>
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="space-y-2 mt-2">
                      {/* Bulk action */}
                      {!isResolved && list.sample_cards.length > 1 && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="sm" variant="secondary" disabled={isListRepairing} className="text-xs h-7 w-full">
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Inverter todos os {list.sample_cards.length} cards suspeitos abaixo
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Inverter {list.sample_cards.length} cards?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Isso vai trocar term ↔ translation em cada um dos {list.sample_cards.length} cards suspeitos mostrados.
                                Os metadados da lista (lang/labels) não serão alterados.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() =>
                                  handleSwapAllFlagged(
                                    list.list_id,
                                    list.sample_cards.map((c) => c.id)
                                  )
                                }
                              >
                                Confirmar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}

                      {list.sample_cards.map((card) => (
                        <CardRow
                          key={card.id}
                          card={card}
                          langA={list.lang_a || "en"}
                          langB={list.lang_b || "pt"}
                          labelsA={labelsA}
                          labelsB={labelsB}
                          onSwap={(id) => handleSwapCards(list.list_id, [id])}
                          onEdit={(id, term, trans) => handleEditCard(list.list_id, id, term, trans)}
                          isRepairing={isListRepairing}
                        />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
