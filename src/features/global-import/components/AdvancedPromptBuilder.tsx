import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { GlobalImportDestinationMode } from "../destinationModes";
import { buildGlobalImportPrompt } from "../prompt";
import { initialPromptBuilderModel, type PromptBuilderModel } from "./promptModels";
import { PromptStructureFields } from "./PromptStructureFields";

interface Props {
  mode: GlobalImportDestinationMode;
  destinationFolderName?: string;
}

export function AdvancedPromptBuilder({ mode, destinationFolderName }: Props) {
  const [value, setValue] = useState<PromptBuilderModel>(initialPromptBuilderModel);
  const [preview, setPreview] = useState("");
  const cards = useMemo(() => value.folders.reduce(
    (total, folder) => total + folder.lists.reduce((sum, list) => sum + list.cardCount, 0), 0,
  ), [value.folders]);

  const setField = <K extends keyof PromptBuilderModel>(key: K, next: PromptBuilderModel[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
  };

  const generate = () => {
    setPreview(buildGlobalImportPrompt({
      mode,
      destinationFolderName,
      packageName: value.packageName.trim() || "Pacote de flashcards",
      sourceLanguage: value.sourceLanguage.trim() || "Idioma do lado A",
      targetLanguage: value.targetLanguage.trim() || "Idioma do lado B",
      level: value.level.trim() || undefined,
      theme: value.theme.trim() || "Tema definido pelo usuário",
      folders: value.folders.map((folder) => ({
        name: folder.name.trim() || destinationFolderName || "Pasta",
        lists: folder.lists.map((list) => ({ name: list.name.trim() || "Principal", cardCount: list.cardCount })),
      })),
      includeExamples: value.includeExamples,
      includeExplanations: value.includeExplanations,
      allowRepetitions: false,
      extraInstructions: value.extraInstructions,
    }));
  };

  return (
    <Card className="space-y-4 border-0 p-2 shadow-none">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nome do pacote"><Input value={value.packageName} onChange={(event) => setField("packageName", event.target.value)} /></Field>
        <Field label="Nível"><Input value={value.level} onChange={(event) => setField("level", event.target.value)} /></Field>
        <Field label="Idioma do lado A"><Input value={value.sourceLanguage} onChange={(event) => setField("sourceLanguage", event.target.value)} /></Field>
        <Field label="Idioma do lado B"><Input value={value.targetLanguage} onChange={(event) => setField("targetLanguage", event.target.value)} /></Field>
      </div>
      <Field label="Tema"><Input value={value.theme} onChange={(event) => setField("theme", event.target.value)} /></Field>
      <PromptStructureFields mode={mode} folders={value.folders} onChange={(folders) => setField("folders", folders)} />
      <Toggle label="Incluir exemplos" checked={value.includeExamples} onChange={(next) => setField("includeExamples", next)} />
      <Toggle label="Incluir explicações" checked={value.includeExplanations} onChange={(next) => setField("includeExplanations", next)} />
      <Field label="Instruções adicionais"><Textarea value={value.extraInstructions} onChange={(event) => setField("extraInstructions", event.target.value)} /></Field>
      <div className="text-sm text-muted-foreground">Estrutura atual: {cards} flashcard(s).</div>
      <Button className="w-full" onClick={generate}>Gerar prompt avançado</Button>
      {preview && <Textarea value={preview} readOnly onFocus={(event) => event.currentTarget.select()} className="min-h-72 font-mono text-xs" />}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between rounded-lg border p-3"><Label>{label}</Label><Switch checked={checked} onCheckedChange={onChange} /></div>;
}
