import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Layers, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  moveLayerDraft,
  normalizeLayeredCardDrafts,
  validateLayeredCardDrafts,
  type LayeredCardDraft,
} from "@/features/cards/lib/layeredCardDraft";
import { saveLayeredCardGroup } from "@/features/cards/lib/layeredCards";

interface Props {
  principalId: string;
  listId: string;
  term: string;
  translation: string;
  labelA?: string;
  labelB?: string;
}

export const LayeredCardEditor = ({
  principalId,
  listId,
  term,
  translation,
  labelA = "Lado A",
  labelB = "Lado B",
}: Props) => {
  const [layers, setLayers] = useState<LayeredCardDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadLayers = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("flashcards")
      .select("id, term, translation, example_text, example_translation, layer_index")
      .eq("parent_card_id", principalId)
      .is("deleted_at", null)
      .order("layer_index", { ascending: true })
      .limit(500);

    if (error) {
      console.error("[LayeredCardEditor] load failed", error);
      toast.error("Não foi possível carregar as camadas deste card.");
      setLayers([]);
    } else {
      setLayers((data ?? []).map((row: any) => ({
        id: row.id,
        front: row.term ?? "",
        back: row.translation ?? "",
        example: row.example_text ?? null,
        exampleTranslation: row.example_translation ?? null,
      })));
    }
    setLoading(false);
  }, [principalId]);

  useEffect(() => {
    let active = true;
    void loadLayers().catch((error) => {
      if (!active) return;
      console.error("[LayeredCardEditor] load failed", error);
      setLoading(false);
    });
    return () => { active = false; };
  }, [loadLayers]);

  const errors = useMemo(
    () => layers.length > 0 ? validateLayeredCardDrafts(layers) : [],
    [layers],
  );

  const beginLayering = () => {
    setLayers([
      { front: term.trim(), back: translation.trim() },
      { front: "", back: "" },
    ]);
  };

  const updateLayer = (index: number, patch: Partial<LayeredCardDraft>) => {
    setLayers((current) => current.map((layer, layerIndex) => (
      layerIndex === index ? { ...layer, ...patch } : layer
    )));
  };

  const addLayer = () => {
    setLayers((current) => [...current, { front: "", back: "" }]);
  };

  const removeLayer = (index: number) => {
    if (layers.length <= 2) {
      toast.error("Um card em camadas precisa manter pelo menos duas camadas.");
      return;
    }
    setLayers((current) => current.filter((_, layerIndex) => layerIndex !== index));
  };

  const moveLayer = (index: number, direction: -1 | 1) => {
    setLayers((current) => moveLayerDraft(current, index, direction));
  };

  const saveAll = async () => {
    const normalized = normalizeLayeredCardDrafts(layers);
    const validationErrors = validateLayeredCardDrafts(normalized);
    if (validationErrors.length > 0) {
      toast.error(validationErrors[0]);
      return;
    }

    setSaving(true);
    try {
      await saveLayeredCardGroup({
        principalId,
        listId,
        title: term,
        layers: normalized,
      });
      await loadLayers();
      toast.success("Camadas salvas em uma única operação.");
    } catch (error: unknown) {
      console.error("[LayeredCardEditor] save failed", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar as camadas.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium">
            <Layers className="h-4 w-4 text-primary" />
            Camadas do card {layers.length > 0 ? `(${layers.length})` : ""}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Cada camada é uma versão independente do mesmo card. Você decide o que cada uma representa.
          </p>
        </div>
        {layers.length > 0 && (
          <Button type="button" size="sm" variant="outline" onClick={addLayer} disabled={loading || saving || layers.length >= 500}>
            <Plus className="mr-1 h-3.5 w-3.5" />Adicionar camada
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando camadas...</p>
      ) : layers.length === 0 ? (
        <div className="space-y-3 rounded-md border border-dashed p-3">
          <p className="text-xs text-muted-foreground">
            Este é um card normal. Ao transformar, o conteúdo atual vira a primeira camada e você completa a segunda.
          </p>
          <Button type="button" size="sm" variant="secondary" onClick={beginLayering}>
            <Layers className="mr-2 h-4 w-4" />Transformar em card com camadas
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {layers.map((layer, index) => (
            <div key={layer.id ?? `new-${index}`} className="space-y-3 rounded-md border bg-background p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Camada {index + 1}</span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => moveLayer(index, -1)}
                    disabled={index === 0 || saving}
                    aria-label={`Mover Camada ${index + 1} para cima`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => moveLayer(index, 1)}
                    disabled={index === layers.length - 1 || saving}
                    aria-label={`Mover Camada ${index + 1} para baixo`}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => removeLayer(index)}
                    disabled={layers.length <= 2 || saving}
                    aria-label={`Remover Camada ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">{labelA}</Label>
                  <Textarea
                    value={layer.front}
                    onChange={(event) => updateLayer(index, { front: event.target.value })}
                    placeholder={`Conteúdo do ${labelA}`}
                    rows={2}
                    className="resize-y text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">{labelB}</Label>
                  <Textarea
                    value={layer.back}
                    onChange={(event) => updateLayer(index, { back: event.target.value })}
                    placeholder={`Conteúdo do ${labelB}`}
                    rows={2}
                    className="resize-y text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Exemplo opcional</Label>
                  <Input
                    value={layer.example ?? ""}
                    onChange={(event) => updateLayer(index, { example: event.target.value })}
                    placeholder="Exemplo relacionado a esta camada"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tradução do exemplo</Label>
                  <Input
                    value={layer.exampleTranslation ?? ""}
                    onChange={(event) => updateLayer(index, { exampleTranslation: event.target.value })}
                    placeholder="Tradução do exemplo"
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          ))}

          {errors.length > 0 && (
            <p className="text-xs text-destructive" role="alert">{errors[0]}</p>
          )}

          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={saveAll}
            disabled={saving || loading || errors.length > 0}
            className="w-full"
          >
            {saving ? "Salvando todas as camadas..." : "Salvar todas as camadas"}
          </Button>
        </div>
      )}
    </div>
  );
};
