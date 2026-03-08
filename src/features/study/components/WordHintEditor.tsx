/**
 * WordHintEditor — optional, collapsible block for adding word/expression hints.
 *
 * Can be embedded in CreateFlashcardForm and EditFlashcardDialog.
 * If no items exist, shows a small "Add word hints" button.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Languages, ChevronDown, ChevronUp } from "lucide-react";
import type { WordHint } from "@/features/study/lib/wordHints";

interface WordHintEditorProps {
  value: WordHint[];
  onChange: (hints: WordHint[]) => void;
}

export const WordHintEditor = ({ value, onChange }: WordHintEditorProps) => {
  const [isExpanded, setIsExpanded] = useState(value.length > 0);

  const addItem = () => {
    onChange([...value, { text: "", translation: "" }]);
    setIsExpanded(true);
  };

  const updateItem = (index: number, field: keyof WordHint, val: string) => {
    const updated = [...value];
    updated[index] = { ...updated[index], [field]: val };
    onChange(updated);
  };

  const removeItem = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  if (!isExpanded && value.length === 0) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => {
          addItem();
        }}
        className="text-muted-foreground gap-1.5"
      >
        <Languages className="h-4 w-4" />
        Adicionar tradução por palavra/expressão
      </Button>
    );
  }

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/20">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        <Languages className="h-4 w-4" />
        Tradução por palavra/expressão ({value.length})
        {isExpanded ? <ChevronUp className="h-4 w-4 ml-auto" /> : <ChevronDown className="h-4 w-4 ml-auto" />}
      </button>

      {isExpanded && (
        <div className="space-y-3">
          {value.map((item, index) => (
            <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end p-2 bg-background rounded-md border">
              <div className="space-y-1">
                <Label className="text-xs">Expressão original</Label>
                <Input
                  value={item.text}
                  onChange={(e) => updateItem(index, "text", e.target.value)}
                  placeholder="ex: am going"
                  className="text-sm h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tradução</Label>
                <Input
                  value={item.translation}
                  onChange={(e) => updateItem(index, "translation", e.target.value)}
                  placeholder="ex: estou indo"
                  className="text-sm h-9"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeItem(index)}
                className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              {/* Optional note row */}
              <div className="sm:col-span-2 space-y-1">
                <Input
                  value={item.note || ""}
                  onChange={(e) => updateItem(index, "note", e.target.value)}
                  placeholder="Observação (opcional)"
                  className="text-sm h-9"
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addItem}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Adicionar item
          </Button>
        </div>
      )}
    </div>
  );
};
