import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { parseSpecialImportText, reconcileSpecialImport } from "./lib/parser";
import { applyImportRows, lookupImportCards } from "./lib/service";
import { buildRetryExportPackage, buildSpecialPrompt, copyText, findSpecialExportManifest, saveSpecialExportManifest, updateSpecialExportManifestStatus } from "./lib/protocol";

export function useBridgeState(userId) {
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState("");
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [exportId, setExportId] = useState();
  const [mode, setMode] = useState("replace");
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState("");

  const stats = useMemo(() => rows ? {
    ready: rows.filter((r) => r.status === "found").length,
    existing: rows.filter((r) => r.status === "existing").length,
    problem: rows.filter((r) => !["found", "existing"].includes(r.status)).length,
  } : null, [rows]);

  const reset = () => {
    setRaw(""); setRows(null); setMissing([]); setWarnings([]); setExportId(undefined);
    setMode("replace"); setBusy(false); setReport("");
  };

  const loadFile = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("O arquivo excede 5 MB.");
    try { setRaw(await file.text()); setRows(null); toast.success("Arquivo carregado."); }
    catch { toast.error("Não foi possível ler o arquivo."); }
  };

  const validate = async () => {
    setBusy(true); setReport("");
    try {
      const parsed = parseSpecialImportText(raw);
      const manifest = findSpecialExportManifest(parsed.export_id);
      const reconciled = reconcileSpecialImport(parsed, manifest);
      const db = await lookupImportCards(reconciled.rows);
      setRows(reconciled.rows.map((r) => {
        if (r.status !== "valid" || !r.item || !r.resolved_flashcard_id) return { ...r, id: r.resolved_flashcard_id };
        const current = db.get(r.resolved_flashcard_id);
        if (!current) return { ...r, id: r.resolved_flashcard_id, status: "missing-db", reason: "Card não encontrado no banco." };
        return { ...r, id: r.resolved_flashcard_id, status: current.detailed_explanation?.trim() ? "existing" : "found" };
      }));
      setMissing(reconciled.missing_expected_ids);
      setWarnings(reconciled.warnings);
      setExportId(parsed.export_id);
    } catch (error) { toast.error(error?.message || "Resposta inválida."); }
    finally { setBusy(false); }
  };

  const copyMissing = async () => {
    const manifest = findSpecialExportManifest(exportId);
    if (!manifest) return;
    const retry = buildRetryExportPackage(manifest, missing);
    if (!retry) return;
    saveSpecialExportManifest(retry);
    const copied = await copyText(buildSpecialPrompt(retry));
    toast[copied ? "success" : "error"](copied ? "Prompt dos faltantes copiado." : "Falha ao copiar.");
  };

  const refresh = async (ids) => {
    if (ids.length) {
      try {
        if (window.BroadcastChannel) { const channel = new BroadcastChannel("flashcard-explanations"); channel.postMessage({ type: "applied", ids }); channel.close(); }
        const { data } = await supabase.from("flashcards").select("list_id").in("id", ids);
        [...new Set((data || []).map((r) => r.list_id).filter(Boolean))].forEach((id) => {
          queryClient.invalidateQueries({ queryKey: ["list-flashcards", id] });
          queryClient.invalidateQueries({ queryKey: ["flashcards", id] });
        });
      } catch {}
    }
    if (userId) ["special-flashcards", "special-flashcards-count", "special-flashcards-details"].forEach((key) => queryClient.invalidateQueries({ queryKey: [key, userId] }));
  };

  const apply = async () => {
    setBusy(true);
    try {
      const accepted = rows.filter((r) => r.item && r.id && (r.status === "found" || (r.status === "existing" && mode !== "skip")))
        .map((r) => ({ item: r.item, flashcardId: r.id }));
      const result = await applyImportRows(accepted, mode);
      const count = (status) => result.filter((r) => r.status === status).length;
      const applied = count("applied");
      const errors = count("error") + count("permission_denied");
      if (exportId) updateSpecialExportManifestStatus(exportId, errors || missing.length ? "partial" : "completed");
      await refresh(result.filter((r) => r.status === "applied").map((r) => r.flashcard_id));
      setReport(`${applied} aplicada(s), ${count("skipped")} ignorada(s), ${missing.length + count("not_found")} faltante(s), ${errors} erro(s).`);
      toast[applied ? "success" : "message"](applied ? `${applied} explicação(ões) aplicada(s).` : "Nenhuma explicação aplicada.");
    } catch (error) { toast.error(error?.message || "Erro ao aplicar."); }
    finally { setBusy(false); }
  };

  return { raw, setRaw, rows, setRows, missing, warnings, exportId, mode, setMode, busy, report, stats, reset, loadFile, validate, copyMissing, apply };
}
