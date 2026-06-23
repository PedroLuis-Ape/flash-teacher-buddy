import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AccountGlossaryManager } from "@/features/study/components/AccountGlossaryManager";
import { FolderGlossarySyncDialog } from "@/features/study/components/FolderGlossarySyncDialog";
import { useFolderGlossary } from "@/hooks/useFolderGlossary";
import { matchesSearchQuery } from "@/lib/searchText";

export default function Glossary() {
  const [params] = useSearchParams();
  const folderId = params.get("folder") || undefined;

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title={folderId ? "Glossário da pasta" : "Minha Caixa de Glossário"} showBack />
      <main className="container mx-auto max-w-5xl space-y-4 p-4">
        {folderId ? <FolderGlossaryPanel folderId={folderId} /> : (
          <>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <h1 className="text-xl font-semibold">Glossário central da sua conta</h1>
              <p className="mt-1 text-sm text-muted-foreground">Cada palavra ou expressão é armazenada uma única vez. Todas as listas atuais e futuras consultam esta mesma caixa automaticamente.</p>
            </div>
            <AccountGlossaryManager defaultExpanded />
          </>
        )}
      </main>
    </div>
  );
}

function FolderGlossaryPanel({ folderId }: { folderId: string }) {
  const { data: entries = [], isLoading, error } = useFolderGlossary(folderId);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => entries.filter((entry) => matchesSearchQuery([
    entry.original_text,
    entry.translated_text,
    entry.note,
  ], search)), [entries, search]);

  return (
    <>
      <Card className="flex flex-col gap-3 border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">Glossário desta pasta</h1>
            <Badge variant="secondary">{entries.length.toLocaleString("pt-BR")}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">Este é apenas um recorte da Caixa de Glossário universal. Nenhuma tradução é duplicada por pasta.</p>
        </div>
        <FolderGlossarySyncDialog folderId={folderId} />
      </Card>

      <Card className="space-y-4 p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar termo ou tradução..." className="pl-9" />
        </div>
        {search && <p className="text-xs text-muted-foreground">{filtered.length.toLocaleString("pt-BR")} resultado(s). A filtragem acontece enquanto você digita.</p>}
        {isLoading ? <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p> :
          error ? <p className="text-sm text-destructive">Não foi possível carregar este recorte.</p> :
          filtered.length === 0 ? <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma entrada encontrada. Sincronize a pasta ou altere a busca.</p> :
          <div className="space-y-2">{filtered.slice(0, 500).map((entry) => (
            <div key={entry.id} className="rounded-lg border p-3">
              <p className="text-sm"><strong>{entry.original_text}</strong> <span className="text-muted-foreground">→</span> <span className="font-medium text-primary">{entry.translated_text}</span></p>
              {entry.note && <p className="mt-1 text-xs text-muted-foreground">{entry.note}</p>}
            </div>
          ))}</div>}
      </Card>
    </>
  );
}
