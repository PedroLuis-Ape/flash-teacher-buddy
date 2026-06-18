import { useMemo, useState } from "react";
import { Clipboard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildGlobalImportPrompt, type GlobalImportPromptFolderConfig } from "../prompt";

interface ParsedStructure {
  folders: GlobalImportPromptFolderConfig[];
  errors: string[];
}

function parseStructure(text: string): ParsedStructure {
  const folders = new Map<string, GlobalImportPromptFolderConfig>();
  const errors: string[] = [];

  text.split("\n").forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const parts = trimmed.split("|").map((part) => part.trim());
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
  });

  return { folders: [...folders.values()], errors };
}

export function PromptBuilderCard() {
  const [packageName, setPackageName] = useState("Meu pacote de estudos");
  const [sourceLanguage, setSourceLanguage] = useState("inglês");
  const [targetLanguage, setTargetLanguage] = useState("português do Brasil");
  const [level, setLevel] = useState("A2");
  const [theme, setTheme] = useState("vocabulário e frases úteis");
  const [structure, setStructure] = useState(
    "Inglês para Viagem | Aeroporto | 12\nInglês para Viagem | Hotel | 10\nPhrasal Verbs | Movimento | 15",
  );

  const parsed = useMemo(() => parseStructure(structure), [structure]);
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
      toast.error("Adicione pelo menos uma linha de estrutura.");
      return;
    }

    const prompt = buildGlobalImportPrompt({
      packageName: packageName.trim() || "Pacote de estudos",
      sourceLanguage: sourceLanguage.trim() || "idioma principal",
      targetLanguage: targetLanguage.trim() || "idioma da tradução",
      level: level.trim() || undefined,
      theme: theme.trim() || "conteúdo definido pelo usuário",
      folders: parsed.folders,
      includeExamples: true,
      includeTags: false,
      allowRepetitions: false,
    });

    try {
      await navigator.clipboard.writeText(prompt);
      toast.success(`Prompt copiado com ${parsed.folders.length} pasta(s) e ${totalCards} cards planejados.`);
    } catch {
      toast.error("Não foi possível copiar o prompt.");
    }
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Gerador de prompt</h2>
        <p className="text-sm text-muted-foreground">
          Defina livremente os nomes das pastas, das listas e a quantidade de cards de cada lista.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="prompt-package-name">Nome do pacote</Label>
          <Input id="prompt-package-name" value={packageName} onChange={(event) => setPackageName(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="prompt-level">Nível</Label>
          <Input id="prompt-level" value={level} onChange={(event) => setLevel(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="prompt-source-language">Idioma principal</Label>
          <Input id="prompt-source-language" value={sourceLanguage} onChange={(event) => setSourceLanguage(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="prompt-target-language">Idioma da tradução</Label>
          <Input id="prompt-target-language" value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)} />
        </div>
      </div>

      <div>
        <Label htmlFor="prompt-theme">Tema e orientação geral</Label>
        <Input id="prompt-theme" value={theme} onChange={(event) => setTheme(event.target.value)} />
      </div>

      <div>
        <Label htmlFor="prompt-structure">Estrutura: Pasta | Lista | Quantidade</Label>
        <Textarea
          id="prompt-structure"
          value={structure}
          onChange={(event) => setStructure(event.target.value)}
          className="min-h-32 font-mono text-sm"
          placeholder="Nome da pasta | Nome da lista | 10"
        />
        <p className="mt-2 text-xs text-muted-foreground">
          {parsed.errors.length
            ? parsed.errors[0]
            : `${parsed.folders.length} pasta(s), ${parsed.folders.reduce((sum, folder) => sum + folder.lists.length, 0)} lista(s) e ${totalCards} cards.`}
        </p>
      </div>

      <Button variant="outline" className="w-full" onClick={copyPrompt}>
        <Clipboard className="mr-2 h-4 w-4" />Copiar prompt genérico
      </Button>
    </Card>
  );
}
