import { Check, FolderTree, ListPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type V3FlowKind = "quick" | "structured";

interface Props {
  value: V3FlowKind;
  onChange: (value: V3FlowKind) => void;
}

const OPTIONS = [
  {
    id: "quick" as const,
    title: "Adicionar cards a uma lista",
    description: "Escolha uma lista existente. Nenhuma pasta ou lista nova será criada.",
    badge: "Recomendado para o dia a dia",
    icon: ListPlus,
  },
  {
    id: "structured" as const,
    title: "Criar ou atualizar uma estrutura",
    description: "Use para pacotes com várias pastas, listas, camadas, explicações e glossário.",
    badge: "Pacotes completos",
    icon: FolderTree,
  },
];

export function FlowChoicePanel({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-semibold">O que você deseja fazer?</h2>
        <p className="text-sm text-muted-foreground">Escolha primeiro a tarefa. O aplicativo mostrará somente as opções necessárias.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
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
