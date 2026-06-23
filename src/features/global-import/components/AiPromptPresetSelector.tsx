import { useMemo, useState } from "react";
import { BookOpenCheck, Check, Clipboard, Eye, Layers3, LibraryBig } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { copyText } from "../copyText";
import { buildFinalGlobalImportPrompt } from "../prompts/finalPrompt";
import { buildOwnerFinalImportPrompt } from "../prompts/ownerFinalPrompt";
import { GLOBAL_IMPORT_AI_PRESETS, type GlobalImportAiPreset, type GlobalImportPromptDestinationContext } from "../prompts/presets";

interface Props {
  context?: GlobalImportPromptDestinationContext;
  smartInterview?: boolean;
}

const ICONS = { batch: Layers3, detailed: BookOpenCheck, complete: LibraryBig } satisfies Record<GlobalImportAiPreset, typeof Layers3>;

function normalized(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function AiPromptPresetSelector({ context, smartInterview = false }: Props) {
  const { user } = useAuth();
  const [preset, setPreset] = useState<GlobalImportAiPreset>("batch");
  const [visible, setVisible] = useState(false);
  const ownerEmail = normalized(import.meta.env.VITE_OWNER_EMAIL);
  const ownerInterview = smartInterview || Boolean(ownerEmail && normalized(user?.email) === ownerEmail);
  const prompt = useMemo(() => (
    ownerInterview && context
      ? buildOwnerFinalImportPrompt(preset, context)
      : buildFinalGlobalImportPrompt(preset, context)
  ), [preset, context, ownerInterview]);
  const selected = GLOBAL_IMPORT_AI_PRESETS.find((item) => item.id === preset)!;

  const copyPrompt = () => {
    if (copyText(prompt)) toast.success(`Prompt “${selected.shortTitle}” copiado.`);
    else toast.error("Não foi possível copiar o prompt.");
  };

  return <Card className="space-y-5 p-5">
    <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">Criar conteúdo com IA</h2><Badge variant="secondary">contrato 2.0</Badge>{ownerInterview && <Badge>entrevista guiada</Badge>}</div><p className="mt-1 text-sm text-muted-foreground">{ownerInterview ? "O perfil escolhido é o ponto de partida. A IA confirma suas preferências antes de gerar o JSON." : "Escolha o nível de conteúdo. O prompt exige um JSON que o App Piteco consegue validar e importar."}</p></div>
    <div className="grid gap-3 lg:grid-cols-3">
      {GLOBAL_IMPORT_AI_PRESETS.map((item) => {
        const Icon = ICONS[item.id];
        const active = item.id === preset;
        return <button key={item.id} type="button" onClick={() => { setPreset(item.id); setVisible(false); }} aria-pressed={active} className={`relative rounded-xl border p-4 text-left transition-colors ${active ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-primary/40 hover:bg-muted/40"}`}>
          {active && <Check className="absolute right-3 top-3 h-4 w-4 text-primary" />}<Icon className="h-5 w-5 text-primary" />
          <div className="mt-3 flex flex-wrap items-center gap-2"><span className="font-semibold">{item.title}</span><Badge variant={active ? "default" : "outline"}>{item.badge}</Badge></div>
          <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">{item.includes.map((label) => <Badge key={label} variant="secondary" className="font-normal">{label}</Badge>)}</div>
        </button>;
      })}
    </div>
    <div className="rounded-lg border bg-muted/30 p-3 text-sm"><strong>{selected.title}:</strong> {selected.description}</div>
    <div className="grid gap-2 sm:grid-cols-2"><Button onClick={copyPrompt}><Clipboard className="mr-2 h-4 w-4" />Copiar este prompt</Button><Button variant="outline" onClick={() => setVisible((value) => !value)}><Eye className="mr-2 h-4 w-4" />{visible ? "Ocultar prompt" : "Visualizar prompt"}</Button></div>
    {visible && <Textarea value={prompt} readOnly onFocus={(event) => event.currentTarget.select()} className="min-h-80 font-mono text-xs" />}
  </Card>;
}
