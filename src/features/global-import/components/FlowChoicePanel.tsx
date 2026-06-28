import { useEffect, useState } from "react";
import { Check, FolderTree, ListPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type V3FlowKind = "quick" | "structured";

interface Props {
  value: V3FlowKind;
  onChange: (value: V3FlowKind) => void;
}

const OPTIONS = [
  {
    id: "structured" as const,
    title: "Criar estrutura do pacote",
    description: "Crie a estrutura recebida ou coloque suas listas dentro de uma pasta existente. Cada lista continua separada.",
    badge: "Mantém pastas e listas",
    icon: FolderTree,
  },
  {
    id: "quick" as const,
    title: "Consolidar dentro de uma lista existente",
    description: "Escolha uma lista pronta. Todos os cards de uma ou várias listas do pacote serão reunidos nela.",
    badge: "Não cria pastas nem listas",
    icon: ListPlus,
  },
];

function flowStorageKey(): string {
  if (typeof window === "undefined") return "app-piteco:guided-import-flow:server";
  const entryKey = typeof window.history.state?.key === "string"
    ? window.history.state.key
    : window.location.pathname;
  return `app-piteco:guided-import-flow:${entryKey}`;
}

function savedFlow(key: string): V3FlowKind | null {
  if (typeof window === "undefined") return null;
  const saved = window.sessionStorage.getItem(key);
  return saved === "quick" || saved === "structured" ? saved : null;
}

export function FlowChoicePanel({ value, onChange }: Props) {
  const [storageKey] = useState(flowStorageKey);

  useEffect(() => {
    const initial = savedFlow(storageKey) ?? "structured";
    if (typeof window !== "undefined") window.sessionStorage.setItem(storageKey, initial);
    onChange(initial);
  }, [onChange, storageKey]);

  const selectFlow = (next: V3FlowKind) => {
    if (typeof window !== "undefined") window.sessionStorage.setItem(storageKey, next);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold">O que você deseja fazer?</h2>
        <p className="text-sm text-muted-foreground">Você pode preservar a estrutura do pacote ou reunir tudo em uma lista que já existe.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => selectFlow(option.id)}
              aria-pressed={active}
              className={`relative rounded-xl border p-5 text-left transition-colors ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40 hover:bg-muted/40"}`}
            >
              {active && <Check className="absolute right-4 top-4 h-5 w-5 text-primary" />}
              <Icon className="h-6 w-6 text-primary" />
              <div className="mt-4 pr-7 text-lg font-semibold">{option.title}</div>
              <p className="mt-1 text-sm text-muted-foreground">{option.description}</p>
              <Badge className="mt-4" variant={active ? "default" : "secondary"}>{option.badge}</Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}
