import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpenCheck, FileText, Folder, FolderOpen, Layers3, LibraryBig, Lightbulb, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { legacyPackageToSmartImport } from "@/features/smart-import/adapters";
import type { SmartImportList, SmartImportPackage } from "@/features/smart-import/schema";
import type { GlobalImportDestinationPlan, ImportDestinationCatalog, ListDestination } from "../destination";
import {
  existingListTargetFromCatalog,
  reconcileExistingListCards,
} from "../existingListImportPlan";
import { loadListCardCatalog } from "../listCardCatalog";
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

interface ConsolidatedDestination {
  listId: string;
  replace: boolean;
}

function statsOf(list?: SmartImportList): ListStats | null {
  if (!list) return null;
  let normalCards = 0;
  let layeredGroups = 0;
  let layeredCards = 0;
  let wordHints = 0;
  let detailedCards = 0;

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

function consolidatedDestination(plan: GlobalImportDestinationPlan): ConsolidatedDestination | null {
  const ids = new Set<string>();
  let replace = false;
  Object.values(plan.folders).forEach((folder) => {
    Object.values(folder.lists).forEach((list) => {
      if (list.mode === "existing" && list.consolidate) {
        ids.add(list.listId);
        if (list.strategy === "replace") replace = true;
      }
    });
  });
  return ids.size === 1 ? { listId: Array.from(ids)[0], replace } : null;
}

export function ImportSimulationTree({ packageValue, smartPackage, catalog, plan }: Props) {
  const effectiveSmartPackage = useMemo(
    () => smartPackage ?? legacyPackageToSmartImport(packageValue),
    [packageValue, smartPackage],
  );
  const smartLists = effectiveSmartPackage.package.folders.flatMap((folder) => folder.lists);
  const consolidated = useMemo(() => consolidatedDestination(plan), [plan]);
  const target = useMemo(
    () => consolidated ? existingListTargetFromCatalog(catalog, consolidated.listId) : null,
    [catalog, consolidated],
  );
  const [existingCards, setExistingCards] = useState<Array<{ term: string; translation: string }>>([]);
  const [cardsLoading, setCardsLoading] = useState(false);
  const [cardsError, setCardsError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!consolidated?.listId || consolidated.replace) {
      setExistingCards([]);
      setCardsError(null);
      setCardsLoading(false);
      return () => { active = false; };
    }
    setCardsLoading(true);
    setCardsError(null);
    loadListCardCatalog(consolidated.listId)
      .then((cards) => { if (active) setExistingCards(cards); })
      .catch((error) => { if (active) setCardsError(error instanceof Error ? error.message : "Não foi possível comparar duplicados."); })
      .finally(() => { if (active) setCardsLoading(false); });
    return () => { active = false; };
  }, [consolidated]);

  const reconciliation = useMemo(
    () => target ? reconcileExistingListCards(effectiveSmartPackage, target, existingCards) : null,
    [effectiveSmartPackage, existingCards, target],
  );
  const sourceLists = effectiveSmartPackage.package.folders.reduce((sum, folder) => sum + folder.lists.length, 0);
  const glossaryEntries = effectiveSmartPackage.package.folders.reduce(
    (folderSum, folder) => folderSum + folder.lists.reduce((listSum, list) => listSum + list.glossary.length, 0),
    0,
  );
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

      {target && (
        <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="font-semibold">Consolidação em {target.folderName} / {target.listName}</h4>
              <p className="text-sm text-muted-foreground">{sourceLists} lista(s) de origem serão reunidas sem criar novas listas.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {consolidated?.replace && <Badge variant="destructive">Conteúdo atual será substituído</Badge>}
              {glossaryEntries > 0 && <Badge variant="secondary">{glossaryEntries} entrada(s) de glossário recebidas</Badge>}
            </div>
          </div>
          {cardsLoading && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Comparando com os cards atuais...</p>}
          {cardsError && <p className="text-sm text-destructive">{cardsError}</p>}
          {!cardsLoading && !cardsError && reconciliation && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric value={reconciliation.cardsReceived} label="Recebidos" />
                <Metric value={reconciliation.cardsValid} label="Válidos e únicos" />
                <Metric value={reconciliation.cardsDuplicates} label="Duplicados" />
                <Metric value={reconciliation.cardsBlocked} label="Bloqueados" />
              </div>
              <p className={`rounded-lg p-3 text-sm ${reconciliation.coherent ? "bg-primary/5" : "bg-destructive/10 text-destructive"}`}>
                {reconciliation.cardsReceived} recebidos = {reconciliation.cardsValid} válidos + {reconciliation.cardsDuplicates} duplicados + {reconciliation.cardsBlocked} bloqueados.
              </p>
            </>
          )}
        </div>
      )}

      <div className="space-y-4">
        {packageValue.package.folders.map((folder, folderIndex) => {
          const folderPlan = plan.folders[folderIndex];
          const destinationFolder =
            folderPlan?.folder.mode === "existing"
              ? catalog.folders.find(
                  (item) =>
                    item.id ===
                    (folderPlan.folder as { mode: "existing"; folderId: string }).folderId,
                )?.title ?? "Pasta existente"
              : folderPlan?.folder.mode === "create"
                ? folderPlan.folder.name
                : folder.name;
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

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg bg-background p-3 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
