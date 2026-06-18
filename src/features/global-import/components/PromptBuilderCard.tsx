import { useMemo, useState } from "react";
import { Clipboard, Eye, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { buildGlobalImportPrompt, getOfficialGlobalImportExample } from "../prompt";
import type { GlobalImportDestinationMode } from "../destinationModes";
import { GLOBAL_IMPORT_LIMITS } from "../schema/globalImportSchema";
import { PromptStructureFields } from "./PromptStructureFields";
import {
  initialPromptBuilderModel,
  promptModelId,
  readSavedPromptModels,
  writeSavedPromptModels,
  type PromptBuilderModel,
  type SavedPromptModel,
} from "./promptModels";

interface PromptBuilderCardProps {
  mode: GlobalImportDestinationMode;
  destinationFolderName?: string;
}

export function PromptBuilderCard({ mode, destinationFolderName }: PromptBuilderCardProps) {
  const [value, setValue] = useState<PromptBuilderModel>(initialPromptBuilderModel);
  const [models, setModels] = useState<SavedPromptModel[]>(readSavedPromptModels);
  const [preview, setPreview] = useState("");
  const [previewTitle, setPreviewTitle] = useState("Prompt gerado");
  const [previewOpen, setPreviewOpen] = useState(false);

  const listCount = useMemo(
    () => value.folders.reduce((sum, folder) => sum + folder.lists.length, 0),
    [value.folders],
  );
  const cardCount = useMemo(
    () => value.folders.reduce(
      (sum, folder) => sum + folder.lists.reduce((listSum, list) => listSum + list.cardCount, 0),
      0,
    ),
    [value.folders],
  );

  const setField = <K extends keyof PromptBuilderModel>(key: K, next: PromptBuilderModel[K]) => {
    setValue((current) => ({ ...current, [key]: next }));
  };

  const validate = (): string | null => {
    if (!value.packageName.trim()) return "Informe o nome do pacote.";
    if (!value.sourceLanguage.trim() || !value.targetLanguage.trim()) return "Informe os idiomas dos dois lados.";
    if (!value.theme.trim()) return "Informe o tema do conteúdo.";
    if (mode !== "from-file" && !destinationFolderName?.trim()) return "Defina a pasta de destino antes de gerar o prompt.";
    if (mode === "from-file" && value.folders.some((folder) => !folder.name.trim())) return "Todas as pastas precisam de nome.";
    if (value.folders.some((folder) => folder.lists.some((list) => !list.name.trim()))) return "Todas as listas precisam de nome.";
    if (value.folders.some((folder) => folder.lists.some((list) => !Number.isInteger(list.cardCount) || list.cardCount < 1))) return "A quantidade de cards precisa ser um número inteiro positivo.";
    if (value.folders.length > GLOBAL_IMPORT_LIMITS.maxFolders) return `O limite é ${GLOBAL_IMPORT_LIMITS.maxFolders} pastas.`;
    if (listCount > GLOBAL_IMPORT_LIMITS.maxLists) return `O limite é ${GLOBAL_IMPORT_LIMITS.maxLists} listas.`;
    if (cardCount > GLOBAL_IMPORT_LIMITS.maxCards) return `O limite é ${GLOBAL_IMPORT_LIMITS.maxCards} cards.`;
    return null;
  };

  const generate = (): string | null => {
    const error = validate();
    if (error) {
      toast.error(error);
      return null;
    }
    const prompt = buildGlobalImportPrompt({
      mode,
      destinationFolderName,
      packageName: value.packageName.trim(),
      description: value.description,
      studyType: value.studyType,
      sourceLanguage: value.sourceLanguage.trim(),
      targetLanguage: value.targetLanguage.trim(),
      labelA: value.labelA,
      labelB: value.labelB,
      ttsEnabled: value.ttsEnabled,
      level: value.level.trim() || undefined,
      theme: value.theme.trim(),
      folders: value.folders.map((folder) => ({
        name: folder.name.trim() || destinationFolderName?.trim() || "Destino escolhido no aplicativo",
        lists: folder.lists.map((list) => ({ name: list.name.trim(), cardCount: list.cardCount })),
      })),
      includeExamples: value.includeExamples,
      includeExplanations: value.includeExplanations,
      allowRepetitions: !value.preventRepetitions,
      extraInstructions: value.extraInstructions,
    });
    setPreview(prompt);
    setPreviewTitle(`Prompt — ${value.packageName.trim()}`);
    toast.success(`Prompt gerado para ${cardCount} cards. O manifesto foi salvo neste dispositivo.`);
    return prompt;
  };

  const copyPrompt = async () => {
    const prompt = generate();
    if (!prompt) return;
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copiado.");
    } catch {
      toast.error("Não foi possível copiar o prompt.");
    }
  };

  const showPreview = () => {
    const prompt = preview || generate();
    if (!prompt) return;
    setPreviewOpen(true);
  };

  const showExample = () => {
    setPreviewTitle("Exemplo oficial derivado do schema");
    setPreview(getOfficialGlobalImportExample());
    setPreviewOpen(true);
  };

  const saveModel = () => {
    const model: SavedPromptModel = {
      id: promptModelId(),
      name: value.packageName.trim() || `Modelo ${models.length + 1}`,
      savedAt: new Date().toISOString(),
      value,
    };
    const next = [model, ...models].slice(0, 30);
    setModels(next);
    writeSavedPromptModels(next);
    toast.success("Modelo salvo.");
  };

  const removeModel = (id: string) => {
    const next = models.filter((model) => model.id !== id);
    setModels(next);
    writeSavedPromptModels(next);
  };

  const focusResponse = () => {
    const target = document.getElementById("global-import-json") as HTMLTextAreaElement | null;
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus();
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Criar conteúdo com IA</h2>
        <p className="text-sm text-muted-foreground">Configure pastas, listas e contagens exatas. O prompt salva um manifesto local para conferir a resposta.</p>
      </div>

      <Tabs defaultValue="simple">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="simple">Simples</TabsTrigger>
          <TabsTrigger value="advanced">Avançado</TabsTrigger>
          <TabsTrigger value="models">Modelos salvos</TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="space-y-4 pt-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Nome do pacote"><Input value={value.packageName} onChange={(event) => setField("packageName", event.target.value)} /></Field>
            <Field label="Nível"><Input value={value.level} onChange={(event) => setField("level", event.target.value)} placeholder="Opcional" /></Field>
            <Field label="Idioma do lado A"><Input value={value.sourceLanguage} onChange={(event) => setField("sourceLanguage", event.target.value)} /></Field>
            <Field label="Idioma do lado B"><Input value={value.targetLanguage} onChange={(event) => setField("targetLanguage", event.target.value)} /></Field>
          </div>
          <Field label="Tema"><Input value={value.theme} onChange={(event) => setField("theme", event.target.value)} /></Field>
          <Field label="Descrição opcional"><Textarea value={value.description} onChange={(event) => setField("description", event.target.value)} /></Field>
          <PromptStructureFields mode={mode} folders={value.folders} onChange={(folders) => setField("folders", folders)} />
        </TabsContent>

        <TabsContent value="advanced" className="space-y-4 pt-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Tipo de estudo">
              <Select value={value.studyType} onValueChange={(next) => setField("studyType", next as PromptBuilderModel["studyType"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="language">Idiomas</SelectItem>
                  <SelectItem value="general">Geral</SelectItem>
                  <SelectItem value="math">Matemática</SelectItem>
                  <SelectItem value="visual">Visual</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Rótulo do lado A"><Input value={value.labelA} onChange={(event) => setField("labelA", event.target.value)} placeholder="Usa o idioma quando vazio" /></Field>
            <Field label="Rótulo do lado B"><Input value={value.labelB} onChange={(event) => setField("labelB", event.target.value)} placeholder="Usa o idioma quando vazio" /></Field>
          </div>
          <Toggle label="Incluir exemplos" checked={value.includeExamples} onChange={(next) => setField("includeExamples", next)} />
          <Toggle label="Incluir explicações" checked={value.includeExplanations} onChange={(next) => setField("includeExplanations", next)} />
          <Toggle label="Impedir repetições" checked={value.preventRepetitions} onChange={(next) => setField("preventRepetitions", next)} />
          <Toggle label="Ativar leitura por voz" checked={value.ttsEnabled} onChange={(next) => setField("ttsEnabled", next)} />
          <Field label="Instruções adicionais"><Textarea value={value.extraInstructions} onChange={(event) => setField("extraInstructions", event.target.value)} /></Field>
        </TabsContent>

        <TabsContent value="models" className="space-y-2 pt-3">
          {models.length === 0 && <p className="text-sm text-muted-foreground">Nenhum modelo salvo.</p>}
          {models.map((model) => (
            <div key={model.id} className="flex items-center gap-2 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{model.name}</div>
                <div className="text-xs text-muted-foreground">{new Date(model.savedAt).toLocaleString()}</div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setValue(model.value)}>Carregar</Button>
              <Button variant="ghost" size="icon" onClick={() => removeModel(model.id)} aria-label="Excluir modelo"><Trash2 className="h-4 w-4" /></Button>
            </div>
          ))}
        </TabsContent>
      </Tabs>

      <div className="rounded-lg bg-muted p-3 text-sm">{value.folders.length} pasta(s), {listCount} lista(s) e {cardCount} card(s).</div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Button onClick={generate}>Gerar prompt</Button>
        <Button variant="outline" onClick={copyPrompt}><Clipboard className="mr-2 h-4 w-4" />Copiar prompt</Button>
        <Button variant="outline" onClick={showPreview}><Eye className="mr-2 h-4 w-4" />Visualizar</Button>
        <Button variant="outline" onClick={showExample}>Ver exemplo</Button>
        <Button variant="outline" onClick={() => setValue(initialPromptBuilderModel())}><RotateCcw className="mr-2 h-4 w-4" />Restaurar padrão</Button>
        <Button variant="outline" onClick={saveModel}><Save className="mr-2 h-4 w-4" />Salvar como modelo</Button>
        <Button variant="outline" onClick={focusResponse}>Colar resposta da IA</Button>
      </div>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
          <DialogHeader><DialogTitle>{previewTitle}</DialogTitle></DialogHeader>
          <Textarea value={preview} readOnly className="min-h-[60vh] resize-none font-mono text-xs" />
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <div className="flex items-center justify-between rounded-lg border p-3"><Label>{label}</Label><Switch checked={checked} onCheckedChange={onChange} /></div>;
}
