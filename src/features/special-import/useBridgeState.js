import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { decodeImportFile } from "@/features/global-import/importSourceDecoder";
import { toast } from "sonner";
import { reconcileSpecialImport } from "./lib/parser";
import { isSpecialCardsExport, parseSpecialImportInput } from "./lib/csvImport";
import { applyImportRows, lookupImportCards } from "./lib/service";
import { buildRetryExportPackage, buildSpecialPrompt, copyText, findSpecialExportManifest, saveSpecialExportManifest, updateSpecialExportManifestStatus } from "./lib/protocol";

export function useBridgeState(userId) {
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [exportId, setExportId] = useState();
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState(null);
  const [report, setReport] = useState("");

  const stats = useMemo(() => rows ? {
    total: rows.length,
    ready: rows.filter((row) => row.status === "found").length,
    existing: rows.filter((row) => row.status === "existing").length,
    problem: rows.filter((row) => !["found", "existing"].includes(row.status)).length,
  } : null, [rows]);

  const reset = () => {
    setRaw("");
    setFileName("");
    setRows(null);
    setMissing([]);
    setWarnings([]);
    setExportId(undefined);
    setBusy(false);
    setPhase("");
    setProgress(null);
    setReport("");
  };

  const loadFile = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("O arquivo excede 5 MB.");
    try {
      const decoded = await decodeImportFile(file);
      setRaw(decoded.text);
      setFileName(file.name);
      setRows(null);
      setWarnings(decoded.warnings);
      setReport("");
      toast.success(`${file.name} carregado.`);
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  };

  const validate = async () => {
    setBusy(true);
    setPhase("Conferindo arquivo");
    setProgress(null);
    setReport("");
    try {
      if (isSpecialCardsExport(raw)) {
        throw new Error("Este é o arquivo de saída para a IA. Importe o arquivo devolvido pela IA, já com detailed_explanation preenchida.");
      }
      const parsed = parseSpecialImportInput(raw);
      const manifest = findSpecialExportManifest(parsed.export_id);
      const reconciled = reconcileSpecialImport(parsed, manifest);
      const db = await lookupImportCards(reconciled.rows, (value) => setProgress(value));
      setRows(reconciled.rows.map((row) => {
        if (row.status !== "valid" || !row.item || !row.resolved_flashcard_id) {
          return { ...row, id: row.resolved_flashcard_id };
        }
        const current = db.get(row.resolved_flashcard_id);
        if (!current) {
          return { ...row, id: row.resolved_flashcard_id, status: "missing-db", reason: "Card não encontrado no banco." };
        }
        return {
          ...row,
          id: row.resolved_flashcard_id,
          status: current.detailed_explanation?.trim() ? "existing" : "found",
        };
      }));
      setMissing(reconciled.missing_expected_ids);
      setWarnings((current) => Array.from(new Set([...current, ...reconciled.warnings])));
      setExportId(parsed.export_id);
    } catch (error) {
      toast.error(error?.message || "Resposta inválida.");
    } finally {
      setBusy(false);
      setPhase("");
      setProgress(null);
    }
  };

  const copyMissing = async () => {
    const manifest = findSpecialExportManifest(exportId);
    if (!manifest) return;
    const retry = buildRetryExportPackage(manifest, missing);
    if (!retry) return;

    const copied = await copyText(buildSpecialPrompt(retry));
    if (!copied) {
      toast.error("Falha ao copiar. A exportação atual foi preservada para nova tentativa.");
      return;
    }

    const saved = saveSpecialExportManifest(retry);
    if (!saved) {
      toast.error("O prompt foi copiado, mas o novo lote não pôde ser registrado. Copie novamente antes de importar.");
      return;
    }

    setExportId(retry.export_id);
    toast.success("Prompt dos faltantes copiado.");
  };

  const refresh = async (ids) => {
    if (ids.length && userId) {
      const removed = new Set(ids);
      queryClient.setQueryData(["special-flashcards", userId], (current = []) => (
        current.filter((id) => !removed.has(id))
      ));
      queryClient.setQueryData(["special-flashcards-details", userId], (current = []) => (
        current.filter((card) => !removed.has(card.flashcard_id))
      ));
      queryClient.setQueryData(["special-flashcards-count", userId], (current = 0) => (
        Math.max(0, current - removed.size)
      ));
    }

    if (ids.length) {
      try {
        if (window.BroadcastChannel) {
          const channel = new BroadcastChannel("flashcard-explanations");
          channel.postMessage({ type: "applied", ids });
          channel.close();
        }
        const { data, error } = await supabase.from("flashcards").select("list_id").in("id", ids);
        if (error) throw error;
        [...new Set((data || []).map((row) => row.list_id).filter(Boolean))].forEach((id) => {
          queryClient.invalidateQueries({ queryKey: ["list-flashcards", id] });
          queryClient.invalidateQueries({ queryKey: ["flashcards", id] });
        });
      } catch (error) {
        console.error("Falha ao atualizar listas afetadas pela importação:", error);
      }
    }

    if (userId) {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["special-flashcards", userId] }),
        queryClient.invalidateQueries({ queryKey: ["special-flashcards-count", userId] }),
        queryClient.invalidateQueries({ queryKey: ["special-flashcards-details", userId] }),
      ]);
    }
  };

  const apply = async () => {
    if (!rows) return;
    setBusy(true);
    setPhase("Substituindo explicações");
    setProgress(null);
    try {
      const accepted = rows
        .filter((row) => row.item && row.id && (row.status === "found" || row.status === "existing"))
        .map((row) => ({ item: row.item, flashcardId: row.id }));
      const result = await applyImportRows(accepted, (value) => setProgress(value));
      const count = (status) => result.filter((row) => row.status === status).length;
      const removedIds = result
        .filter((row) => row.status === "applied" && row.removed_from_specials === true)
        .map((row) => row.flashcard_id);
      const applied = count("applied");
      const removed = removedIds.length;
      const notFound = count("not_found");
      const denied = count("permission_denied");
      const errors = count("error") + denied;
      const kept = Math.max(0, accepted.length - removed);

      if (exportId) {
        updateSpecialExportManifestStatus(
          exportId,
          errors || missing.length || notFound || kept ? "partial" : "completed",
        );
      }
      await refresh(removedIds);
      setReport(`${applied} explicação(ões) substituída(s) · ${removed} removido(s) dos Especiais · ${missing.length + notFound} faltante(s) · ${denied} sem permissão · ${count("error")} erro(s) · ${kept} mantido(s) na fila.`);
      toast[removed ? "success" : "message"](
        removed
          ? `${removed} card(s) substituído(s) e removido(s) dos Especiais.`
          : "Nenhum card foi removido dos Especiais.",
      );
    } catch (error) {
      toast.error(error?.message || "Erro ao aplicar.");
    } finally {
      setBusy(false);
      setPhase("");
      setProgress(null);
    }
  };

  return {
    raw,
    setRaw,
    fileName,
    rows,
    setRows,
    missing,
    warnings,
    exportId,
    busy,
    phase,
    progress,
    report,
    stats,
    reset,
    loadFile,
    validate,
    copyMissing,
    apply,
  };
}
