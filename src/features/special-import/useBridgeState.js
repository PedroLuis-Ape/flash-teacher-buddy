import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { reconcileSpecialImport } from "./lib/parser";
import { isSpecialCardsExport, parseSpecialImportInput } from "./lib/csvImport";
import { applyImportRows, lookupImportCards } from "./lib/service";
import {
  buildRetryExportPackage,
  buildSpecialPrompt,
  copyText,
  findSpecialExportManifest,
  saveSpecialExportManifest,
  updateSpecialExportManifestStatus,
} from "./lib/protocol";
import {
  buildSpecialV3RetryBatch,
  buildSpecialV3Txt,
  findSpecialV3Manifest,
  isSpecialV3ExportText,
  looksLikeSpecialV3Result,
  parseSpecialV3Result,
  reconcileSpecialV3Result,
  saveSpecialV3Manifest,
  updateSpecialV3ManifestStatus,
} from "./lib/v3Protocol";

export function useBridgeState(userId) {
  const queryClient = useQueryClient();
  const [raw, setRaw] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState(null);
  const [missing, setMissing] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [exportId, setExportId] = useState();
  const [batchId, setBatchId] = useState();
  const [protocolVersion, setProtocolVersion] = useState(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [progress, setProgress] = useState(null);
  const [report, setReport] = useState("");

  const stats = useMemo(() => rows ? {
    total: rows.length,
    ready: rows.filter((row) => row.status === "found").length,
    existing: rows.filter((row) => row.status === "existing").length,
    changed: rows.filter((row) => row.status === "changed").length,
    problem: rows.filter((row) => !["found", "existing"].includes(row.status)).length,
  } : null, [rows]);

  const reset = () => {
    setRaw("");
    setFileName("");
    setRows(null);
    setMissing([]);
    setWarnings([]);
    setExportId(undefined);
    setBatchId(undefined);
    setProtocolVersion(null);
    setBusy(false);
    setPhase("");
    setProgress(null);
    setReport("");
  };

  const loadFile = async (file) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) return toast.error("O arquivo excede 5 MB.");
    try {
      setRaw(await file.text());
      setFileName(file.name);
      setRows(null);
      setReport("");
      toast.success(`${file.name} carregado.`);
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    }
  };

  const validate = async () => {
    setBusy(true);
    setPhase("Validando estrutura e identificadores");
    setProgress(null);
    setReport("");
    try {
      if (isSpecialV3ExportText(raw) || isSpecialCardsExport(raw)) {
        throw new Error("Este é o arquivo enviado para a IA. Importe o JSON devolvido pela IA, já com as explicações preenchidas.");
      }

      let reconciled;
      let nextExportId;
      let nextBatchId;
      let nextProtocol;

      if (looksLikeSpecialV3Result(raw)) {
        const parsedV3 = parseSpecialV3Result(raw);
        const manifestV3 = findSpecialV3Manifest(parsedV3.export_id, parsedV3.batch_id);
        reconciled = reconcileSpecialV3Result(parsedV3, manifestV3);
        nextExportId = parsedV3.export_id;
        nextBatchId = parsedV3.batch_id;
        nextProtocol = "v3";
      } else {
        const parsed = parseSpecialImportInput(raw);
        const manifest = findSpecialExportManifest(parsed.export_id);
        reconciled = reconcileSpecialImport(parsed, manifest);
        nextExportId = parsed.export_id;
        nextBatchId = undefined;
        nextProtocol = parsed.source === "v2" ? "v2" : "legacy";
      }

      setPhase("Conferindo cards atuais no banco");
      const db = await lookupImportCards(reconciled.rows, (value) => setProgress(value));
      const checkedRows = reconciled.rows.map((row) => {
        if (row.status !== "valid" || !row.item || !row.resolved_flashcard_id) {
          return { ...row, id: row.resolved_flashcard_id };
        }
        const current = db.get(row.resolved_flashcard_id);
        if (!current) {
          return {
            ...row,
            id: row.resolved_flashcard_id,
            status: "missing-db",
            reason: "Card não encontrado no banco ou removido.",
          };
        }

        if (nextProtocol === "v3") {
          if (!current.special_item_id) {
            return {
              ...row,
              id: row.resolved_flashcard_id,
              status: "changed",
              reason: "O card não está mais na fila de Especiais. Exporte-o novamente antes de aplicar.",
            };
          }
          if (row.item.item_id !== current.special_item_id) {
            return {
              ...row,
              id: row.resolved_flashcard_id,
              status: "changed",
              reason: "O item da fila foi recriado depois da exportação. Gere um novo TXT.",
            };
          }
          if (row.item.source_hash !== current.source_hash) {
            return {
              ...row,
              id: row.resolved_flashcard_id,
              status: "changed",
              reason: "O card ou o foco pedagógico foi alterado após a exportação. Gere um novo TXT para este card.",
            };
          }
        }

        return {
          ...row,
          id: row.resolved_flashcard_id,
          status: current.detailed_explanation?.trim() ? "existing" : "found",
        };
      });

      setRows(checkedRows);
      setMissing(reconciled.missing_expected_ids);
      setWarnings(reconciled.warnings);
      setExportId(nextExportId);
      setBatchId(nextBatchId);
      setProtocolVersion(nextProtocol);
    } catch (error) {
      toast.error(error?.message || "Resposta inválida.");
    } finally {
      setBusy(false);
      setPhase("");
      setProgress(null);
    }
  };

  const copyMissing = async () => {
    if (protocolVersion === "v3" && exportId && batchId) {
      const manifest = findSpecialV3Manifest(exportId, batchId);
      if (!manifest) return toast.error("O lote original não foi encontrado.");
      const retry = buildSpecialV3RetryBatch(manifest, missing);
      if (!retry) return;
      const copied = await copyText(buildSpecialV3Txt(retry));
      if (!copied) return toast.error("Não foi possível copiar o novo TXT.");
      if (!saveSpecialV3Manifest(retry)) {
        return toast.error("O TXT foi copiado, mas o lote não pôde ser registrado. Exporte novamente antes de importar.");
      }
      setExportId(retry.export_id);
      setBatchId(retry.batch_id);
      toast.success("TXT somente dos cards faltantes copiado.");
      return;
    }

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
    setPhase("Aplicando explicações e atualizando a fila");
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
      const unresolved = missing.length + notFound + (stats?.changed ?? 0) + (stats?.problem ?? 0) - (stats?.changed ?? 0);

      if (exportId) {
        const status = errors || unresolved || kept ? "partial" : "completed";
        if (protocolVersion === "v3" && batchId) {
          updateSpecialV3ManifestStatus(exportId, batchId, status);
        } else {
          updateSpecialExportManifestStatus(exportId, status);
        }
      }
      await refresh(removedIds);
      setReport(`${applied} explicação(ões) aplicada(s) · ${removed} removido(s) dos Especiais · ${missing.length + notFound} faltante(s) · ${stats?.changed ?? 0} alterado(s) após exportação · ${denied} sem permissão · ${count("error")} erro(s) · ${kept} mantido(s) na fila.`);
      toast[removed ? "success" : "message"](
        removed
          ? `${removed} card(s) atualizado(s) e removido(s) dos Especiais.`
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
    batchId,
    protocolVersion,
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
