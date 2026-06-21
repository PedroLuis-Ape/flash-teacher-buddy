import { useMemo, useState } from "react";
import { BookOpen, ChevronDown, ChevronUp, Download, FileUp, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useListGlossary } from "@/hooks/useListGlossary";
import { parseGlossaryTransfer, serializeGlossaryTransfer } from "@/features/study/lib/glossaryTransfer";

interface Props {
  listId?: string;
  labelA?: string;
  labelB?: string;
  canEdit?: boolean;
  defaultExpanded?: boolean;
}

const DISPLAY_LIMIT = 300;

export function AccountGlossaryManager({
  listId,
  labelA = "Lado A",
  labelB = "Lado B",
  canEdit = true,
  defaultExpanded = false,
}: Props) {
  const { glossary, isLoading, error, addEntry, deleteEntry, toggleActive, importEntries } = useListGlossary(listId);
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [original, setOriginal] = useState("");
  const [translation, setTranslation] = useState("");
  const [side, setSide] = useState<"A" | "B">("A");
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return glossary;
    return glossary.filter((entry) =>
      [entry.original_text, entry.translated_text, entry.note]
        .filter(Boolean)
        .some((value) => String(value).toLocaleLowerCase().includes(query)),
    );
  }, [glossary, search]);
  const visible = filtered.slice(0, DISPLAY_LIMIT);
  const parsed = useMemo(() => parseGlossaryTransfer(importText, side), [importText, side]);

  const add = () => {
    if (!original.trim() || !translation.trim()) return;
    addEntry.mutate({ original_text: original.trim(), translated_text: translation.trim(), side }, {
      onSuccess: () => {
        setOriginal("");
        setTranslation("");
        setAdding(false);
      },
    });
  };

  const importGlossary = async () => {
    if (parsed.entries.length === 0) return;
    await importEntries.mutateAsync(parsed.entries);
    setImportText("");
    setImportOpen(false);
  };

  const download = () => {
    const blob = new Blob([serializeGlossaryTransfer(glossary, "json")], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "app-piteco-caixa-glossario.json";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (!canEdit && glossary.length === 0) return null;

  return <>
    <Card className="p-4">
      <button type="button" onClick={() => setExpanded((value) => !value)} className="flex w-full items-start gap-3 text-left">
        <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{canEdit ? "Minha Caixa de Glossário" : "Glossário do professor"}</span>
            <Badge variant="secondary">{glossary.length.toLocaleString("pt-BR")}</Badge>
            {canEdit && <Badge variant="outline">todas as listas</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {canEdit ? "Um termo é salvo uma vez e funciona em cards atuais e futuros." : "Glossário central compartilhado com esta lista."}
          </p>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {expanded && <div className="mt-4 space-y-4">
        {error && <p className="text-sm text-destructive">Não foi possível carregar o glossário.</p>}
        <div className="flex flex-col gap-2 md:flex-row md:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar termo ou tradução..." className="pl-9" />
          </div>
          <div className="flex gap-2">
            {canEdit && <Button size="sm" variant="outline" onClick={() => setAdding((value) => !value)}><Plus className="mr-1 h-4 w-4" />Adicionar</Button>}
            {canEdit && <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}><FileUp className="mr-1 h-4 w-4" />Importar</Button>}
            <Button size="sm" variant="outline" onClick={download} disabled={glossary.length === 0}><Download className="mr-1 h-4 w-4" />JSON</Button>
          </div>
        </div>

        {canEdit && adding && <div className="grid gap-2 rounded-lg border p-3 md:grid-cols-2">
          <Input value={original} onChange={(event) => setOriginal(event.target.value)} placeholder="Termo original" />
          <Input value={translation} onChange={(event) => setTranslation(event.target.value)} placeholder="Tradução" />
          <div className="flex gap-2">
            <Button size="sm" variant={side === "A" ? "default" : "outline"} onClick={() => setSide("A")}>{labelA}</Button>
            <Button size="sm" variant={side === "B" ? "default" : "outline"} onClick={() => setSide("B")}>{labelB}</Button>
          </div>
          <div className="flex justify-end gap-2"><Button variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button><Button onClick={add}>Salvar</Button></div>
        </div>}

        {isLoading ? <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p> :
          visible.length === 0 ? <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nenhuma entrada.</p> :
          <div className="space-y-2">{visible.map((entry) => <div key={entry.id} className={`flex items-start gap-2 rounded-lg border p-3 ${entry.is_active ? "" : "opacity-55"}`}>
            <div className="min-w-0 flex-1">
              <p className="text-sm"><strong>{entry.original_text}</strong> <span className="text-muted-foreground">→</span> <span className="font-medium text-primary">{entry.translated_text}</span></p>
              <div className="mt-1 flex gap-1"><Badge variant="outline" className="text-[10px]">{entry.side === "A" ? labelA : labelB}</Badge>{/\s/u.test(entry.original_text) && <Badge variant="secondary" className="text-[10px]">Expressão</Badge>}</div>
            </div>
            {canEdit && <><Switch checked={entry.is_active} onCheckedChange={(checked) => toggleActive.mutate({ id: entry.id, is_active: checked })} className="scale-75" /><Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => { if (window.confirm(`Excluir “${entry.original_text}”?`)) deleteEntry.mutate(entry.id); }}><Trash2 className="h-4 w-4" /></Button></>}
          </div>)}</div>}

        {filtered.length > DISPLAY_LIMIT && <p className="text-xs text-muted-foreground">Mostrando {DISPLAY_LIMIT} de {filtered.length.toLocaleString("pt-BR")}. Use a busca para refinar.</p>}
      </div>}
    </Card>

    <Dialog open={importOpen} onOpenChange={setImportOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Importar para a Caixa de Glossário</DialogTitle></DialogHeader>
        <div className="space-y-2"><Label>JSON ou texto compatível</Label><Textarea value={importText} onChange={(event) => setImportText(event.target.value)} className="min-h-[320px] font-mono text-xs" /><Badge variant="secondary">{parsed.entries.length} válida(s)</Badge>{parsed.errors.slice(0, 5).map((message) => <p key={message} className="text-xs text-destructive">{message}</p>)}</div>
        <DialogFooter><Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button><Button onClick={() => void importGlossary()} disabled={parsed.entries.length === 0 || importEntries.isPending}>Importar</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
