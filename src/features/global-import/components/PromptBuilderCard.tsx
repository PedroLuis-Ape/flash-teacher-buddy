import { useMemo, useState } from "react";
import { Clipboard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildGlobalImportPrompt, type GlobalImportPromptFolderConfig } from "../prompt";
import type { GlobalImportDestinationMode } from "../destinationModes";

interface PromptBuilderCardProps {
  mode: GlobalImportDestinationMode;
  destinationFolderName?: string;
}

interface ParsedStructure {
  folders: GlobalImportPromptFolderConfig[];
  errors: string[];
}

function parseStructure(
  text: string,
  mode: GlobalImportDestinationMode,
  destinationFolderName?: string,
): ParsedStructure {
  const folders = new Map<string, GlobalImportPromptFolderConfig>();
  const errors: string[] = [];

  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.split("|").map((part) => part.trim());

    if (mode === "from-file") {
      if (parts.length !== 3) {
        errors.push(`Linha ${index + 1}: use Pasta | Lista | Quantidade.`);
        return;
      }
      const [folderName, listName, countText] = parts;
      const count = Number(countText);
      if (!folderName || !listName || !Number.isInteger(count) || count <= 0) {
        errors.push(`Linha ${index + 1}: pasta, lista e quantidade positiva são obrigatórias.`);
        return;
      }
      const folder = folders.get(folderName) ?? { name: folderName, lists: [] };
      folder.lists.push({ name: listName, cardCount: count });
      folders.set(folderName, folder);
      return;
    }

    if (parts.length !== 2) {
      errors.push(`Linha ${index + 1}: use Lista | Quantidade. A pasta já foi definida na interface.`);
      return;
    }
    const [listName, countText] = parts;
    const count = Number(countText);
    if (!listName || !Number.isInteger(count) || count <= 0) {
      errors.push(`Linha ${index + 1}: lista e quantidade positiva são obrigatórias.`);
      return;
    }
    const folderName = destinationFolderName?.trim() || "Destino escolhido no aplicativo";
    const folder = folders.get(folderName) ?? { name: folderName, lists: [] };
    folder.lists.push({ name: listName, cardCount: count });
    folders.set(folderName, folder);
  });

  return { folders: [...folders.values()], errors };
}

export function PromptBuilderCard({ mode, destinationFolderName }: PromptBuilderCardProps) {
  const [packageName, setPackageName] = useState("");
  const [sourceLanguage, setSourceLanguage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [level, setLevel] = useState("");
  const [theme, setTheme] = useState("");
  const [extraInstructions, setExtraInstructions] = useState("");
  const [structure, setStructure] = useState("");

  const parsed = useMemo(
    () => parseStructure(structure, mode, destinationFolderName),
    [structure, mode, destinationFolderName],
  );
  const totalCards = parsed.folders.reduce(
    (folderTotal, folder) => folderTotal + folder.lists.reduce((listTotal, list) => listTotal + list.cardCount, 0),
    0,
  );

  const copyPrompt = async () => {
    if (parsed.errors.length) {
      toast.error(parsed.errors[0]);
      return;
    }
    if (!parsed.folders.length) {
      toast.error("Adicione pelo menos uma lista à estrutura.");
      return;
    }
    if (mode !== "from-file" && !destinationFolderName?.trim()) {
      toast.error("Defina a pasta de destino antes de gerar o prompt.");
      return;
    }

    const prompt = buildGlobalImportPrompt({
      mode,
      destinationFolderName,
      packageName: packageName.trim() || "Pacote de estudos",
      sourceLanguage: sourceLanguage.trim() || "idioma principal definido pelo usuário",
      targetLanguage: targetLanguage.trim() || "idioma de tradução definido pelo usuário",
      level: level.trim() || undefined,
      theme: theme.trim() || "tema definido pelo usuário",
      folders: parsed.folders,
      includeExamples: true,
      includeTags: false,
      allowRepetitions: false,
      extraInstructions,
    });

    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(`Prompt copiado com ${parsed.folders.length} pasta(s) e ${totalCards} cards planejados.`);
    } catch {
      toast.error("Não foi possível copiar o prompt.");
    }
  };

  const structureLabel = mode === "from-file"
    ? "Estrutura: Pasta | Lista | Quantidade"
    : "Estrutura: Lista | Quantidade";
  const structurePlaceholder = mode === "from-file"
    ? "Nome da pasta | Nome da lista | 10"
    : "Nome da lista | 10";

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Gerador de prompt</h2>
        <p className="text-sm text-muted-foreground">
          O prompt acompanha o modo de destino e usa somente os nomes, quantidades e orientações preenchidos aqui.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="prompt-package-name">Nome do pacote</Label>
          <Input id="prompt-package-name" value={packageName} onChange={(event) => setPackageName(event.target.value)} placeholder="Ex.: Revisão de atendimento" />
        </div>
        <div>
          <Label htmlFor="prompt-level">Nível</Label>
          <Input id="prompt-level" value={level} onChange={(event) => setLevel(event.target.value)} placeholder="Opcional" />
        </div>
        <div>
          <Label htmlFor="prompt-source-language">Idioma principal</Label>
          <Input id="prompt-source-language" value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)} placeholder="Ex.: inglês" />
        </div>
        <div>
          <Label htmlFor="prompt-target-language">Idioma da tradução</Label>
          <Input id="prompt-target-language" value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} placeholder="Ex.: português" />
        </div>
      </div>

      <div>
        <Label htmlFor="prompt-theme">Tema e orientação geral</Label>
        <Input id="prompt-theme" value={theme} onChange={(event) => setTheme(event.target.value)} placeholder="Descreva livremente o conteúdo" />
      </div>

      <div>
        <Label htmlFor="prompt-structure">{structureLabel}</Label>
        <Textarea
          id="prompt-structure"
          value={structure}
          onChange={(event) => setStructure(event.target.value)}
          className="min-h-32 font-mono text-sm"
          placeholder={structurePlaceholder}
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {parsed.errors.length
            ? parsed.errors[0]
            : `${parsed.folders.length} pasta(s), ${parsed.folders.reduce((sum, folder) => sum + folder.lists.length, 0)} lista(s) e ${totalCards} cards.`}
        </p>
      </div>

      <div>
        <Label htmlFor="prompt-extra">Instruções adicionais</Label>
        <Textarea id="prompt-extra" value={extraInstructions} onChange={(event) => setExtraInstructions(event.target.value)} placeholder="Opcional" />
      </div>

      <Button variant="outline" className="w-full" onClick={copyPrompt}>
        <Clipboard className="mr-2 h-4 w-4" />Copiar prompt dinâmico
      </Button>
    </Card>
  );
}
