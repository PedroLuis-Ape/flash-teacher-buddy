import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";

interface LayerRow {
  id?: string;
  term: string;
  translation: string;
  hint: string | null;
  example_text: string | null;
  example_translation: string | null;
  detailed_explanation: string | null;
  usage_notes: string | null;
  common_mistakes: string | null;
  context_tag: string | null;
  layer_index: number;
  _dirty?: boolean;
}

interface Props {
  principalId: string;
  listId: string;
  userId: string;
  term: string;
}

const clean = (value: string | null) => value?.trim() || null;

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
        .select("id, term, translation, hint, example_text, example_translation, detailed_explanation, usage_notes, common_mistakes, context_tag, layer_index")
        .eq("parent_card_id", principalId)
        .is("deleted_at", null)
        .order("layer_index", { ascending: true })
        .limit(500);
      if (cancelled) return;
      if (error) {
        console.error("[LayeredCardEditor] load failed", error);
        setLayers([]);
      } else {
        setLayers((data ?? []).map((row: any, index: number) => ({
          id: row.id,
          term: row.term ?? term,
          translation: row.translation ?? "",
          hint: row.hint ?? null,
          example_text: row.example_text ?? null,
          example_translation: row.example_translation ?? null,
          detailed_explanation: row.detailed_explanation ?? null,
          usage_notes: row.usage_notes ?? null,
          common_mistakes: row.common_mistakes ?? null,
          context_tag: row.context_tag ?? null,
          layer_index: row.layer_index ?? index,
        })));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [principalId, term]);

  const update = (index: number, patch: Partial<LayerRow>) => {
    setLayers((current) => current.map((layer, layerIndex) =>
      layerIndex === index ? { ...layer, ...patch, _dirty: true } : layer));
  };

  const addLayer = () => {
    if (layers.length === 0) {
      toast.info("Para criar um grupo novo, selecione e mescle pelo menos dois cards na lista.");
      return;
    }
    setLayers((current) => [...current, {
      term,
      translation: "",
      hint: null,
      example_text: null,
      example_translation: null,
      detailed_explanation: null,
      usage_notes: null,
      common_mistakes: null,
      context_tag: null,
      layer_index: current.length,
      _dirty: true,
    }]);
  };

  const removeLayer = async (index: number) => {
    if (layers.length <= 2) {
      toast.error("Um grupo precisa manter pelo menos duas camadas.");
      return;
    }

    const layer = layers[index];
    if (layer.id) {
      const { error } = await supabase.from("flashcards").delete().eq("id", layer.id);
      if (error) {
        toast.error(error.message || "Erro ao remover camada");
        return;
      }
    }

    setLayers((current) => current
      .filter((_, layerIndex) => layerIndex !== index)
      .map((item, layerIndex) => ({
        ...item,
        layer_index: layerIndex,
        _dirty: true,
      })));
  };

  const saveAll = async () => {
    if (layers.length < 2) {
      toast.error("Um grupo precisa ter pelo menos duas camadas.");
      return;
    }
    if (layers.some((layer) => !layer.term.trim() || !layer.translation.trim())) {
      toast.error("Preencha a frente e o verso de todas as camadas.");
      return;
    }

    setSaving(true);
    try {
      const saved: LayerRow[] = [];
      for (let index = 0; index < layers.length; index += 1) {
        const layer = layers[index];
        const payload = {
          list_id: listId,
          user_id: userId,
          term: layer.term.trim(),
          translation: layer.translation.trim(),
          hint: clean(layer.hint),
          example_text: clean(layer.example_text),
          example_translation: clean(layer.example_translation),
          detailed_explanation: clean(layer.detailed_explanation),
          usage_notes: clean(layer.usage_notes),
          common_mistakes: clean(layer.common_mistakes),
          context_tag: clean(layer.context_tag),
          parent_card_id: principalId,
          layer_index: index,
        };

        if (layer.id) {
          if (layer._dirty || layer.layer_index !== index) {
            const { error } = await supabase
              .from("flashcards")
              .update(payload)
              .eq("id", layer.id);
            if (error) throw error;
          }
          saved.push({ ...layer, ...payload, id: layer.id, _dirty: false });
        } else {
          const { data, error } = await supabase
            .from("flashcards")
            .insert(payload)
            .select("id")
            .single();
          if (error) throw error;
          saved.push({ ...layer, ...payload, id: data.id, _dirty: false });
        }
      }
      setLayers(saved);
      toast.success("Camadas salvas");
    } catch (error: any) {
      console.error("[LayeredCardEditor] save failed", error);
      toast.error(error?.message || "Erro ao salvar camadas");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Layers className="h-4 w-4" />
          Camadas de significado ({layers.length})
        </div>
        <Button type="button" size="sm" variant="outline" onClick={addLayer} disabled={loading || layers.length === 0}>
          <Plus className="mr-1 h-3.5 w-3.5" />Adicionar
        </Button>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Carregando camadas...</p>
      ) : layers.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Este é um card normal. Para transformá-lo em grupo, selecione pelo menos dois cards na lista e use “Mesclar em camadas”.
        </p>
      ) : (
        <ul className="space-y-3">
          {layers.map((layer, index) => (
            <li key={layer.id ?? `new-${index}`} className="space-y-3 rounded-md border bg-background p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">Camada {index + 1}</span>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => removeLayer(index)}
                  disabled={layers.length <= 2}
                  aria-label="Remover camada"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Frente">
                  <Input value={layer.term} onChange={(event) => update(index, { term: event.target.value })} />
                </Field>
                <Field label="Verso">
                  <Input value={layer.translation} onChange={(event) => update(index, { translation: event.target.value })} />
                </Field>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Exemplo">
                  <Input value={layer.example_text ?? ""} onChange={(event) => update(index, { example_text: event.target.value })} />
                </Field>
                <Field label="Tradução do exemplo">
                  <Input value={layer.example_translation ?? ""} onChange={(event) => update(index, { example_translation: event.target.value })} />
                </Field>
              </div>

              <details className="rounded-md border bg-muted/20 p-2">
                <summary className="cursor-pointer text-xs font-medium">Detalhes pedagógicos</summary>
                <div className="mt-3 space-y-2">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Dica">
                      <Input value={layer.hint ?? ""} onChange={(event) => update(index, { hint: event.target.value })} />
                    </Field>
                    <Field label="Contexto">
                      <Input value={layer.context_tag ?? ""} onChange={(event) => update(index, { context_tag: event.target.value })} />
                    </Field>
                  </div>
                  <Field label="Explicação detalhada">
                    <Textarea value={layer.detailed_explanation ?? ""} onChange={(event) => update(index, { detailed_explanation: event.target.value })} />
                  </Field>
                  <Field label="Notas de uso">
                    <Textarea value={layer.usage_notes ?? ""} onChange={(event) => update(index, { usage_notes: event.target.value })} />
                  </Field>
                  <Field label="Erros comuns">
                    <Textarea value={layer.common_mistakes ?? ""} onChange={(event) => update(index, { common_mistakes: event.target.value })} />
                  </Field>
                </div>
              </details>
            </li>
          ))}
        </ul>
      )}

      {layers.length >= 2 && (
        <Button type="button" size="sm" variant="secondary" onClick={saveAll} disabled={saving || loading} className="w-full">
          {saving ? "Salvando camadas..." : "Salvar camadas"}
        </Button>
      )}
    </div>
  );
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
