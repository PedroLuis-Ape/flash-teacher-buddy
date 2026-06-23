import { ArrowRight, BookOpenCheck, FileText, Folder, FolderOpen, Layers3, LibraryBig, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { SmartImportList, SmartImportPackage } from "@/features/smart-import/schema";
import type { GlobalImportDestinationPlan, ImportDestinationCatalog, ListDestination } from "../destination";
import type { GlobalImportPackage } from "../schema";

interface Props {
  packageValue: GlobalImportPackage;
  smartPackage: SmartImportPackage | null;
  catalog: ImportDestinationCatalog;
  plan: GlobalImportDestinationPlan;
}

interface ListStats {
  normalCards: number;
  layeredGroups: number;
  layeredCards: number;
  glossaryEntries: number;
  wordHints: number;
  detailedCards: number;
}

function statsOf(list?: SmartImportList): ListStats | null {
  if (!list) return null;
  let normalCards = 0;
  let layeredGroups = 0;
  let layeredCards = 0;
  let wordHints = 0;
  let detailedCards = 0;

  const inspect = (card: SmartImportList["cards"][number] extends infer T ? T : never) => card;
  void inspect;

  list.cards.forEach((card) => {
    const playable = card.type === "normal" ? [card] : card.layers;
    if (card.type === "normal") normalCards += 1;
    else {
      layeredGroups += 1;
      layeredCards += card.layers.length;
    }
    playable.forEach((item) => {
      wordHints += item.word_hints?.length ?? 0;
      if (
        item.detailed_explanation
        || item.short_observation
        || item.usage_notes
        || item.common_mistakes
        || item.example
        || item.example_translation
      ) detailedCards += 1;
    });
  });

  return {
    normalCards,
    layeredGroups,
    layeredCards,
    glossaryEntries: list.glossary.length,
    wordHints,
    detailedCards,
  };
}

function listDestinationLabel(
  destination: ListDestination | undefined,
  catalog: ImportDestinationCatalog,
) {
  if (!destination) return { title: "Destino não definido", badge: "Pendente", tone: "destructive" as const };
  if (destination.mode === "skip") return { title: "Esta lista não será importada", badge: "Ignorar", tone: "outline" as const };
  if (destination.mode === "create") return { title: destination.name, badge: "Nova lista", tone: "default" as const };
  const list = catalog.lists.find((item) => item.id === destination.listId);
  const strategy = destination.strategy ?? "append";
  return {
    title: list?.title ?? "Lista existente",
    badge: strategy === "replace" ? "Substituir" : "Adicionar",
    tone: strategy === "replace" ? "destructive" as const : "secondary" as const,
  };
}

export function ImportSimulationTree({ packageValue, smartPackage, catalog, plan }: Props) {
  const smartLists = smartPackage?.package.folders.flatMap((folder) => folder.lists) ?? [];
  let smartListIndex = 0;

  return (
    <Card className="space-y-5 p-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">Como ficará depois da importação</h3>
          <Badge variant="secondary">simulação</Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Esta árvore mostra o destino final. Nada foi gravado no banco ainda.
        </p>
      </div>

      <div className="space-y-4">
        {packageValue.package.folders.map((folder, folderIndex) => {
          const folderPlan = plan.folders[folderIndex];
          const destinationFolder = folderPlan?.folder.mode === "existing"
            ? catalog.folders.find((item) => item.id === folderPlan.folder.folderId)?.title ?? "Pasta existente"
            : folderPlan?.folder.name ?? folder.name;
          const existingFolder = folderPlan?.folder.mode === "existing";

          return (
            <details key={`${folder.name}-${folderIndex}`} open className="overflow-hidden rounded-xl border bg-card">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4 hover:bg-muted/30">
                {existingFolder
                  ? <FolderOpen className="h-5 w-5 shrink-0 text-primary" />
                  : <Folder className="h-5 w-5 shrink-0 text-primary" />}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{destinationFolder}</span>
                    <Badge variant={existingFolder ? "outline" : "default"}>{existingFolder ? "Pasta existente" : "Nova pasta"}</Badge>
                  </div>
                  {folder.name !== destinationFolder && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      Recebida como “{folder.name}” <ArrowRight className="h-3 w-3" /> destino final
                    </div>
                  )}
                </div>
                <Badge variant="secondary">{folder.lists.length} lista(s)</Badge>
              </summary>

              <div className="space-y-3 border-t bg-muted/10 p-3 sm:p-4">
                {folder.lists.map((list, listIndex) => {
                  const smartList = smartLists[smartListIndex++];
                  const stats = statsOf(smartList);
                  const destination = listDestinationLabel(folderPlan?.lists[listIndex], catalog);
                  const skipped = folderPlan?.lists[listIndex]?.mode === "skip";

                  return (
                    <details key={`${list.name}-${listIndex}`} className={`rounded-lg border bg-background ${skipped ? "opacity-60" : ""}`}>
                      <summary className="flex cursor-pointer list-none items-start gap-3 p-3 sm:p-4">
                        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{destination.title}</span>
                            <Badge variant={destination.tone}>{destination.badge}</Badge>
                          </div>
                          {list.name !== destination.title && !skipped && (
                            <p className="mt-1 text-xs text-muted-foreground">Conteúdo recebido da lista “{list.name}”.</p>
                          )}
                        </div>
                        <Badge variant="outline">{list.cards.length} unidade(s)</Badge>
                      </summary>

                      {!skipped && (
                        <div className="flex flex-wrap gap-2 border-t p-3 text-xs">
                          {stats ? (
                            <>
                              <Badge variant="outline" className="gap-1"><FileText className="h-3 w-3" />{stats.normalCards} normal(is)</Badge>
                              {stats.layeredGroups > 0 && <Badge variant="secondary" className="gap-1"><Layers3 className="h-3 w-3" />{stats.layeredGroups} grupo(s), {stats.layeredCards} camada(s)</Badge>}
                              {stats.detailedCards > 0 && <Badge variant="secondary" className="gap-1"><BookOpenCheck className="h-3 w-3" />{stats.detailedCards} detalhado(s)</Badge>}
                              {stats.wordHints > 0 && <Badge variant="secondary" className="gap-1"><Lightbulb className="h-3 w-3" />{stats.wordHints} dica(s)</Badge>}
                              {stats.glossaryEntries > 0 && <Badge variant="secondary" className="gap-1"><LibraryBig className="h-3 w-3" />{stats.glossaryEntries} termo(s) no glossário</Badge>}
                            </>
                          ) : (
                            <span className="text-muted-foreground">{list.cards.length} card(s) serão processados.</span>
                          )}
                        </div>
                      )}
                    </details>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </Card>
  );
}
