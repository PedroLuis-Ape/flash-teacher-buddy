/**
 * LayeredCardEditor — manages meaning layers attached to a principal card.
 *
 * - Loads existing layers (flashcards.parent_card_id = principalId).
 * - Allows editing translation / example / example_translation per layer.
 * - Allows adding a new empty layer or removing an existing layer.
 * - All persistence is performed in this component; the parent edit dialog
 *   does not need to know layers exist.
 *
 * Pure additive: when a card has zero layers and the user adds none, nothing
 * is changed in the database.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";

interface LayerRow {
  id?: string; // undefined = new (not yet saved)
  translation: string;
  example_text: string | null;
  example_translation: string | null;
  layer_index: number;
  _dirty?: boolean;
}

interface Props {
  principalId: string;
  listId: string;
  userId: string;
  term: string;
}

export const LayeredCardEditor = ({ principalId, listId, userId, term }: Props) => {
  const [layers, setLayers] = useState<LayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("flashcards")
        .select("id, translation, example_text, example_translation, layer_index")
        .eq("parent_card_id", principalId)
        .order("layer_index", { ascending: true })
        .limit(100);
      if (cancelled) return;
      if (error) {
        console.error("[LayeredCardEditor] load failed", error);
        setLayers([]);
      } else {
        setLayers(
          (data ?? []).map((r: any, i: number) => ({
            id: r.id,
            translation: r.translation ?? "",
            example_text: r.example_text ?? null,
            example_translation: r.example_translation ?? null,
            layer_index: r.layer_index ?? i,
          }))
        );
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [principalId]);

  const update = (idx: number, patch: Partial<LayerRow>) => {
    setLayers((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch, _dirty: true };
      return next;
    });
  };

  const addLayer = () => {
    setLayers((prev) => [
      ...prev,
      {
        translation: "",
        example_text: null,
        example_translation: null,
        layer_index: prev.length,
        _dirty: true,
      },
    ]);
  };

  const removeLayer = async (idx: number) => {
    const layer = layers[idx];
    if (layer.id) {
      const { error } = await supabase.from("flashcards").delete().eq("id", layer.id);
      if (error) {
        toast.error("Erro ao remover camada");
        return;
      }
    }
    setLayers((prev) => prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, layer_index: i })));
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < layers.length; i++) {
        const L = { ...layers[i], layer_index: i };
        if (!L.translation.trim()) continue;
        if (L.id) {
          if (!L._dirty) continue;
          const { error } = await supabase
            .from("flashcards")
            .update({
              translation: L.translation.trim(),
              example_text: L.example_text?.trim() || null,
              example_translation: L.example_translation?.trim() || null,
              layer_index: i,
            })
            .eq("id", L.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase
            .from("flashcards")
            .insert({
              list_id: listId,
              user_id: userId,
              term,
              translation: L.translation.trim(),
              example_text: L.example_text?.trim() || null,
              example_translation: L.example_translation?.trim() || null,
              parent_card_id: principalId,
              layer_index: i,
            })
            .select("id")
            .single();
          if (error) throw error;
          setLayers((prev) => {
            const next = [...prev];
            next[i] = { ...next[i], id: data!.id, _dirty: false };
            return next;
          });
        }
      }
      toast.success("Camadas salvas");
    } catch (e: any) {
      console.error("[LayeredCardEditor] save failed", e);
      toast.error(e?.message || "Erro ao salvar camadas");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Layers className="h-4 w-4" />
          Camadas de significado ({layers.length})
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addLayer} disabled={loading}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando camadas...</p>
      ) : layers.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Este card não tem camadas. Adicione uma para criar significados extras (mantém o card atual intacto).
        </p>
      ) : (
        <ul className="space-y-3">
          {layers.map((L, idx) => (
            <li key={L.id ?? `new-${idx}`} className="space-y-2 border rounded-md p-2 bg-background">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Camada {idx + 1}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => removeLayer(idx)}
                  aria-label="Remover camada"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Significado</Label>
                <Input
                  value={L.translation}
                  onChange={(e) => update(idx, { translation: e.target.value })}
                  placeholder="Ex.: pegar / conseguir"
                  className="text-sm"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Exemplo</Label>
                  <Input
                    value={L.example_text ?? ""}
                    onChange={(e) => update(idx, { example_text: e.target.value })}
                    placeholder="I got a new phone."
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tradução do exemplo</Label>
                  <Input
                    value={L.example_translation ?? ""}
                    onChange={(e) => update(idx, { example_translation: e.target.value })}
                    placeholder="Eu consegui um celular novo."
                    className="text-sm"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {layers.length > 0 && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={saveAll}
          disabled={saving || loading}
          className="w-full"
        >
          {saving ? "Salvando camadas..." : "Salvar camadas"}
        </Button>
      )}
    </div>
  );
};