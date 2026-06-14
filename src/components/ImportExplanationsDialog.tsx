import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import {
  APPLY_BATCH,
  VALIDATE_LOOKUP_BATCH,
  runInBatches,
} from "@/features/special-import/lib/chunking";

type ConflictMode = "replace" | "append" | "skip";

interface ParsedItem {
  flashcard_id?: string;
  term?: string;
  translation?: string;
  detailed_explanation?: string;
  usage_notes?: string;
  common_mistakes?: string;
  example_text?: string;
  example_translation?: string;
  examples?: Array<{ en?: string; pt?: string }>;
}

interface PreviewRow {
  item: ParsedItem;
  status: "found" | "missing" | "has-existing" | "invalid";
  existingExplanation?: string | null;
  reason?: string;
}

interface NormalizedResult {
  item: ParsedItem | null;
  invalidReason?: string;
  raw: any;
}

function normalizeItem(raw: any): NormalizedResult {
  if (!raw || typeof raw !== "object") {
    return { item: null, invalidReason: "Item não é um objeto", raw };
  }
  // Strict: never accept raw.id silently as flashcard_id.
  const flashcard_id = raw.flashcard_id ?? raw.flashcardId ?? undefined;
  const detailed_explanation =
    raw.detailed_explanation ?? raw.detailedExplanation ?? raw.explanation ?? undefined;
  if (!flashcard_id || typeof flashcard_id !== "string") {
    return { item: null, invalidReason: "Campo flashcard_id ausente", raw };
  }
  if (!detailed_explanation || typeof detailed_explanation !== "string") {
    return { item: null, invalidReason: "Campo detailed_explanation ausente", raw };
  }
  return {
    item: {
      flashcard_id,
      term: raw.term,
      translation: raw.translation,
      detailed_explanation,
      usage_notes: raw.usage_notes ?? raw.usageNotes ?? undefined,
      common_mistakes: raw.common_mistakes ?? raw.commonMistakes ?? undefined,
      example_text: raw.example_text ?? undefined,
      example_translation: raw.example_translation ?? undefined,
      examples: Array.isArray(raw.examples) ? raw.examples : undefined,
    },
    raw,
  };
}

function tryParseJson(text: string): NormalizedResult[] | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  // Tolerate markdown fences (```json ... ``` or bare ``` ... ```).
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  try {
    const parsed = JSON.parse(cleaned);
    const arr = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.items)
        ? parsed.items
        : null;
    if (!arr) return null;
    return arr.map(normalizeItem);
  } catch {
    return null;
  }
}

function buildExtraFromExamples(item: ParsedItem): string {
  const parts: string[] = [];
  if (item.examples && item.examples.length > 1) {
    const extras = item.examples.slice(1);
    parts.push("\n\nExemplos adicionais:");
    extras.forEach((ex, i) => {
      const en = ex?.en ?? "";
      const pt = ex?.pt ?? "";
      parts.push(`\n${i + 2}. ${en}${pt ? ` — ${pt}` : ""}`);
    });
  }
  return parts.join("");
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId?: string;
}

export default function ImportExplanationsDialog({ open, onOpenChange, userId }: Props) {
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [validating, setValidating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [progress, setProgress] = useState<{
    phase: "validate" | "apply";
    processed: number;
    total: number;
  } | null>(null);
  const [conflictMode, setConflictMode] = useState<ConflictMode>("replace");
  const [report, setReport] = useState<{
    applied: number;
    removedFromSpecials: number;
    skipped: number;
    invalid: number;
    missing: number;
    errors: number;
  } | null>(null);

  const reset = () => {
    setRaw("");
    setPreview(null);
    setReport(null);
    setConflictMode("replace");
    setProgress(null);
  };

  const stats = useMemo(() => {
    if (!preview) return null;
    return {
      total: preview.length,
      found: preview.filter((r) => r.status === "found").length,
      hasExisting: preview.filter((r) => r.status === "has-existing").length,
      missing: preview.filter((r) => r.status === "missing").length,
      invalid: preview.filter((r) => r.status === "invalid").length,
    };
  }, [preview]);

  const handleValidate = async () => {
    setReport(null);
    const results = tryParseJson(raw);
    if (!results) {
      toast.error("JSON inválido. Cole a resposta da IA (array de objetos).");
      return;
    }
    if (results.length === 0) {
      toast.error("JSON vazio.");
      return;
    }
    setValidating(true);
    setProgress({ phase: "validate", processed: 0, total: 0 });
    try {
      const validItems = results
        .filter((r): r is NormalizedResult & { item: ParsedItem } => !!r.item);
      const ids = Array.from(new Set(validItems.map((r) => r.item.flashcard_id!)));
      let map = new Map<string, { detailed_explanation: string | null }>();
      if (ids.length > 0) {
        // Lookup em lotes de 100 — evita uma única consulta com milhares de
        // ids no .in() (causa long task no parser do PostgREST e no cliente).
        const batchResults = await runInBatches(
          ids,
          VALIDATE_LOOKUP_BATCH,
          async (batchIds) => {
            const { data, error } = await supabase
              .from("flashcards")
              .select("id, detailed_explanation")
              .in("id", batchIds);
            if (error) throw error;
            return (data as any[]) ?? [];
          },
          {
            onProgress: (p) =>
              setProgress({
                phase: "validate",
                processed: p.processed,
                total: p.total,
              }),
          }
        );
        for (const rows of batchResults) {
          for (const r of rows) {
            map.set(r.id, { detailed_explanation: r.detailed_explanation ?? null });
          }
        }
      }
      const rows: PreviewRow[] = results.map((r) => {
        if (!r.item) {
          return {
            item: {
              flashcard_id: r.raw?.flashcard_id ?? r.raw?.flashcardId ?? r.raw?.id,
              term: r.raw?.term,
              translation: r.raw?.translation,
            },
            status: "invalid",
            reason: r.invalidReason ?? "Item inválido",
          };
        }
        const existing = map.get(r.item.flashcard_id!);
        if (!existing) return { item: r.item, status: "missing" };
        if (
          existing.detailed_explanation &&
          existing.detailed_explanation.trim().length > 0
        ) {
          return {
            item: r.item,
            status: "has-existing",
            existingExplanation: existing.detailed_explanation,
          };
        }
        return { item: r.item, status: "found" };
      });
      setPreview(rows);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao validar: " + (e?.message ?? "desconhecido"));
    } finally {
      setValidating(false);
      setProgress(null);
    }
  };

  const handleApply = async () => {
    if (!preview) return;
    setApplying(true);
    setProgress({ phase: "apply", processed: 0, total: 0 });
    const invalidCount = preview.filter((r) => r.status === "invalid").length;
    const missingCount = preview.filter((r) => r.status === "missing").length;
    try {
      // Build the items payload sent to the RPC. Each row carries the parsed
      // explanation already extended with extra examples (kept here, since the
      // RPC only handles textual append/replace via conflict mode).
      const items = preview
        .filter((r) => r.status === "found" || r.status === "has-existing")
        .map((row) => {
          const item = row.item;
          let explanation = item.detailed_explanation ?? "";
          explanation = explanation + buildExtraFromExamples(item);
          const firstEx = item.examples?.[0];
          return {
            flashcard_id: item.flashcard_id,
            detailed_explanation: explanation,
            usage_notes: item.usage_notes ?? null,
            common_mistakes: item.common_mistakes ?? null,
            example_text: firstEx?.en ?? item.example_text ?? null,
            example_translation: firstEx?.pt ?? item.example_translation ?? null,
          };
        });
      // Aplica em lotes pequenos contra a RPC existente. A RPC já é
      // idempotente por item (somente status === 'applied' remove dos
      // Especiais), portanto uma divisão em lotes preserva o contrato.
      const allResults: Array<{ flashcard_id: string; status: string; message?: string }> = [];
      await runInBatches(
        items,
        APPLY_BATCH,
        async (batch) => {
          const { data, error } = await (supabase as any).rpc(
            'apply_special_flashcard_explanations',
            { p_items: batch, p_conflict_mode: conflictMode },
          );
          if (error) throw error;
          const partial = (data?.results ?? []) as typeof allResults;
          allResults.push(...partial);
        },
        {
          onProgress: (p) =>
            setProgress({ phase: "apply", processed: p.processed, total: p.total }),
        }
      );
      const results = allResults;
      const applied = results.filter((r) => r.status === 'applied').length;
      const skipped = results.filter((r) => r.status === 'skipped').length;
      const permission = results.filter((r) => r.status === 'permission_denied').length;
      const notFoundFromRpc = results.filter((r) => r.status === 'not_found').length;
      const invalidFromRpc = results.filter((r) => r.status === 'invalid').length;
      const errors = results.filter((r) => r.status === 'error').length;
      const removedFromSpecials = applied; // RPC only deletes when applied
      try {
        const failed = results.filter((r) => r.status !== 'applied' && r.status !== 'skipped');
        if (failed.length > 0) console.warn('[Import] não aplicados', failed);
      } catch {}
      // Notify open Study sessions so they refresh the explanation without resetting state.
      try {
        const appliedIds = results.filter((r) => r.status === 'applied').map((r) => r.flashcard_id);
        if (appliedIds.length > 0 && typeof window !== 'undefined') {
          const BC = (window as any).BroadcastChannel;
          if (typeof BC === 'function') {
            const ch = new BC('flashcard-explanations');
            ch.postMessage({ type: 'applied', ids: appliedIds });
            ch.close();
          } else {
            window.dispatchEvent(new CustomEvent('flashcard-explanations-applied', { detail: { ids: appliedIds } }));
          }
        }
      } catch {}
      setReport({
        applied,
        removedFromSpecials,
        skipped,
        invalid: invalidCount + invalidFromRpc,
        missing: missingCount + notFoundFromRpc,
        errors: errors + permission,
      });
      // Invalidações direcionadas — apenas listas afetadas, não o app todo.
      const appliedIdsSet = new Set(
        results.filter((r) => r.status === 'applied').map((r) => r.flashcard_id)
      );
      if (appliedIdsSet.size > 0) {
        try {
          const { data: affected } = await supabase
            .from("flashcards")
            .select("list_id")
            .in("id", Array.from(appliedIdsSet));
          const listIds = Array.from(
            new Set(((affected as any[]) ?? []).map((r) => r.list_id).filter(Boolean))
          );
          for (const lid of listIds) {
            queryClient.invalidateQueries({ queryKey: ["list-flashcards", lid] });
            queryClient.invalidateQueries({ queryKey: ["flashcards", lid] });
          }
        } catch (err) {
          // fallback discreto — não derrubar o fluxo por causa de cache stale
          console.warn("[Import] invalidação direcionada falhou", err);
        }
      }
      if (userId) {
        queryClient.invalidateQueries({ queryKey: ["special-flashcards", userId] });
        queryClient.invalidateQueries({ queryKey: ["special-flashcards-count", userId] });
        queryClient.invalidateQueries({ queryKey: ["special-flashcards-details", userId] });
      }
      if (applied > 0) {
        toast.success(
          `Explicações aplicadas. ${removedFromSpecials} card(s) com explicação aplicada saíram dos especiais.`
        );
      }
      if (permission > 0) {
        toast.error(
          `${permission} card(s) não atualizados — você não tem permissão de edição. Eles continuam nos especiais.`
        );
      }
      if (notFoundFromRpc > 0) {
        toast.message(`${notFoundFromRpc} card(s) não encontrado(s) — mantidos nos especiais.`);
      }
      if (applied === 0 && permission === 0 && notFoundFromRpc === 0) {
        toast.message("Nenhuma explicação aplicada.");
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao aplicar: " + (e?.message ?? "desconhecido"));
    } finally {
      setApplying(false);
      setProgress(null);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-w-2xl flex flex-col max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Importar explicações da IA</DialogTitle>
          <DialogDescription>
            Cole o JSON gerado pela IA. As explicações serão aplicadas aos
            cards correspondentes pelo flashcard_id.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-3">
          {progress && progress.total > 0 && (
            <div className="text-xs text-muted-foreground">
              {progress.phase === "validate" ? "Validando" : "Aplicando"}:{" "}
              {progress.processed}/{progress.total}
            </div>
          )}
          {!preview && (
            <>
              <Textarea
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder='[{"flashcard_id":"...","detailed_explanation":"..."}]'
                className="min-h-[220px] font-mono text-xs"
              />
              <div className="flex justify-end gap-2">
                <Button
                  onClick={handleValidate}
                  disabled={validating || raw.trim().length === 0}
                >
                  {validating && <Loader2 className="h-4 w-4 animate-spin" />}
                  Validar JSON
                </Button>
              </div>
            </>
          )}

          {preview && (
            <>
              {stats && (
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="secondary">Total: {stats.total}</Badge>
                  <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30">
                    Encontrados: {stats.found}
                  </Badge>
                  <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                    Já com explicação: {stats.hasExisting}
                  </Badge>
                  <Badge variant="destructive">Não encontrados: {stats.missing}</Badge>
                  {stats.invalid > 0 && (
                    <Badge variant="destructive">Inválidos: {stats.invalid}</Badge>
                  )}
                </div>
              )}

              {stats && stats.hasExisting > 0 && (
                <div className="rounded-md border p-3 bg-muted/30">
                  <div className="text-sm font-medium mb-2">
                    Cards já com explicação — o que fazer?
                  </div>
                  <RadioGroup
                    value={conflictMode}
                    onValueChange={(v) => setConflictMode(v as ConflictMode)}
                    className="space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="replace" id="cm-replace" />
                      <Label htmlFor="cm-replace" className="text-sm font-normal">
                        Substituir explicações existentes
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="append" id="cm-append" />
                      <Label htmlFor="cm-append" className="text-sm font-normal">
                        Acrescentar abaixo da existente
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value="skip" id="cm-skip" />
                      <Label htmlFor="cm-skip" className="text-sm font-normal">
                        Ignorar esses cards
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              <ScrollArea className="flex-1 min-h-[180px] max-h-[40vh] rounded-md border">
                <div className="divide-y">
                  {preview.map((row, idx) => (
                    <div key={idx} className="p-3 text-sm">
                      <div className="flex items-start gap-2">
                        {row.status === "found" && (
                          <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                        )}
                        {row.status === "has-existing" && (
                          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                        )}
                        {row.status === "missing" && (
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        )}
                        {row.status === "invalid" && (
                          <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium break-words">
                            {row.item.term ?? "—"}{" "}
                            <span className="text-muted-foreground font-normal">
                              → {row.item.translation ?? "—"}
                            </span>
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono break-all">
                            {row.item.flashcard_id}
                          </div>
                          {row.reason && (
                            <div className="text-xs text-destructive mt-1">
                              {row.reason}
                            </div>
                          )}
                          {row.item.detailed_explanation && (
                            <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {row.item.detailed_explanation}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {report && (
                <div className="rounded-md border p-3 text-sm bg-muted/30">
                  <div className="font-medium mb-1">Resultado</div>
                  <div className="space-y-0.5">
                    <div>{report.applied} aplicada(s)</div>
                    <div>{report.removedFromSpecials} removida(s) dos especiais</div>
                    <div>{report.skipped} ignorada(s)</div>
                    <div>{report.invalid} inválida(s)</div>
                    <div>{report.missing} não encontrada(s)</div>
                    <div>{report.errors} com erro</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          {preview && !report && (
            <Button
              variant="outline"
              onClick={() => {
                setPreview(null);
              }}
              disabled={applying}
            >
              Voltar
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={applying}
          >
            {report ? "Fechar" : "Cancelar"}
          </Button>
          {preview && !report && (
            <Button
              onClick={handleApply}
              disabled={
                applying ||
                !preview.some(
                  (r) =>
                    r.status === "found" ||
                    (r.status === "has-existing" && conflictMode !== "skip")
                )
              }
            >
              {applying && <Loader2 className="h-4 w-4 animate-spin" />}
              Aplicar explicações
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}