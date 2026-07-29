import { AlertTriangle, FolderInput, FolderPlus, ListPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GlobalImportPackage } from "../schema";
import type {
  GlobalImportDestinationPlan,
  ImportDestinationCatalog,
  ListDestination,
} from "../destination";
import type { GlobalImportDestinationMode } from "../destinationModes";

interface Props {
  packageValue: GlobalImportPackage;
  catalog: ImportDestinationCatalog;
  plan: GlobalImportDestinationPlan;
  mode: GlobalImportDestinationMode;
  onChange: (plan: GlobalImportDestinationPlan) => void;
}

const CREATE_FOLDER = "__create_folder__";

function replaceFolderPlan(
  plan: GlobalImportDestinationPlan,
  folderIndex: number,
  nextFolderPlan: GlobalImportDestinationPlan["folders"][number],
): GlobalImportDestinationPlan {
  return {
    ...plan,
    folders: {
      ...plan.folders,
      [folderIndex]: nextFolderPlan,
    },
  };
}

export function DestinationMappingCard({
  packageValue,
  catalog,
  plan,
  mode,
  onChange,
}: Props) {
  const updateFolder = (folderIndex: number, value: string) => {
    const incomingFolder = packageValue.package.folders[folderIndex];
    const nextFolder = value === CREATE_FOLDER
      ? { mode: "create" as const, name: incomingFolder.name }
      : { mode: "existing" as const, folderId: value };
    const nextLists: Record<number, ListDestination> = {};
    incomingFolder.lists.forEach((list, listIndex) => {
      nextLists[listIndex] = { mode: "create", name: list.name };
    });
    onChange(replaceFolderPlan(plan, folderIndex, {
      folder: nextFolder,
      lists: nextLists,
    }));
  };

  const updateList = (
    folderIndex: number,
    listIndex: number,
    destination: ListDestination,
  ) => {
    const folderPlan = plan.folders[folderIndex];
    onChange(replaceFolderPlan(plan, folderIndex, {
      ...folderPlan,
      lists: {
        ...folderPlan.lists,
        [listIndex]: destination,
      },
    }));
  };

  const chooseListMode = (
    folderIndex: number,
    listIndex: number,
    value: ListDestination["mode"],
    availableLists: ImportDestinationCatalog["lists"],
  ) => {
    const incomingList = packageValue.package.folders[folderIndex].lists[listIndex];
    const current = plan.folders[folderIndex].lists[listIndex];
    if (value === "create") {
      updateList(folderIndex, listIndex, {
        mode: "create",
        name: current?.mode === "create" ? current.name : incomingList.name,
      });
      return;
    }
    if (value === "skip") {
      updateList(folderIndex, listIndex, { mode: "skip" });
      return;
    }
    const currentListId = current?.mode === "existing" ? current.listId : "";
    const listId = availableLists.some((list) => list.id === currentListId)
      ? currentListId
      : availableLists[0]?.id ?? "";
    updateList(folderIndex, listIndex, {
      mode: "existing",
      listId,
      strategy: current?.mode === "existing" ? current.strategy ?? "append" : "append",
    });
  };

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="font-semibold">2. Escolha o destino de cada lista</h2>
        <p className="text-sm text-muted-foreground">
          Cada lista recebida pode ter uma decisão diferente. O plano abaixo será o mesmo usado na importação.
        </p>
      </div>

      <div className="space-y-4">
        {packageValue.package.folders.map((folder, folderIndex) => {
          const folderPlan = plan.folders[folderIndex];
          if (!folderPlan) return null;
          const folderTarget = folderPlan.folder;
          const selectedFolderId = folderTarget.mode === "existing"
            ? folderTarget.folderId
            : CREATE_FOLDER;
          const selectedFolder = folderTarget.mode === "existing"
            ? catalog.folders.find((item) => item.id === folderTarget.folderId)
            : null;
          const availableLists = folderTarget.mode === "existing"
            ? catalog.lists.filter((list) => list.folder_id === folderTarget.folderId)
            : [];

          return (
            <details
              key={`${folder.name}-${folderIndex}`}
              className="rounded-xl border"
            >
              <summary className="cursor-pointer select-none p-4">
                <span className="flex min-w-0 items-center gap-2 font-medium">
                  {folderTarget.mode === "existing"
                    ? <FolderInput className="h-4 w-4 shrink-0" />
                    : <FolderPlus className="h-4 w-4 shrink-0" />}
                  <span className="break-words">
                    {folderTarget.mode === "existing"
                      ? `Pasta: ${selectedFolder?.title ?? "Pasta selecionada"}`
                      : `Nova pasta: ${folderTarget.name}`}
                  </span>
                </span>
                <span className="mt-1 block pl-6 text-sm font-normal text-muted-foreground">
                  {folder.lists.length} lista(s),{" "}
                  {folder.lists.reduce((total, list) => total + list.cards.length, 0)} card(s) — clique para editar os destinos
                </span>
              </summary>

              <div className="space-y-4 border-t p-4">
                {mode === "from-file" && (
                  <div>
                    <Label htmlFor={`folder-destination-${folderIndex}`}>Destino da pasta</Label>
                    <Select
                      value={selectedFolderId}
                      onValueChange={(value) => updateFolder(folderIndex, value)}
                    >
                      <SelectTrigger id={`folder-destination-${folderIndex}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={CREATE_FOLDER}>Criar nova pasta “{folder.name}”</SelectItem>
                        {catalog.folders.map((existingFolder) => (
                          <SelectItem key={existingFolder.id} value={existingFolder.id}>
                            Usar pasta existente: {existingFolder.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {folder.lists.map((list, listIndex) => {
                  const listPlan = folderPlan.lists[listIndex];
                  if (!listPlan) return null;
                  const canUseExisting = folderTarget.mode === "existing" && availableLists.length > 0;
                  const baseId = `destination-${folderIndex}-${listIndex}`;

                  return (
                    <article key={`${list.name}-${listIndex}`} className="space-y-3 rounded-lg border bg-muted/20 p-4">
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 font-medium">
                            <ListPlus className="h-4 w-4 shrink-0" />
                            <span className="break-words">Lista recebida: {list.name}</span>
                          </div>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {list.cards.length} card(s)
                          </p>
                        </div>
                      </div>

                      <div>
                        <Label htmlFor={`${baseId}-mode`}>O que fazer com esta lista?</Label>
                        <Select
                          value={listPlan.mode}
                          onValueChange={(value) => chooseListMode(
                            folderIndex,
                            listIndex,
                            value as ListDestination["mode"],
                            availableLists,
                          )}
                        >
                          <SelectTrigger id={`${baseId}-mode`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="create">Criar uma nova lista</SelectItem>
                            <SelectItem value="existing" disabled={!canUseExisting}>
                              Adicionar a uma lista existente
                            </SelectItem>
                            <SelectItem value="skip">Não importar esta lista</SelectItem>
                          </SelectContent>
                        </Select>
                        {!canUseExisting && folderTarget.mode === "existing" && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Esta pasta ainda não possui listas disponíveis.
                          </p>
                        )}
                      </div>

                      {listPlan.mode === "create" && (
                        <div>
                          <Label htmlFor={`${baseId}-name`}>Nome da nova lista</Label>
                          <Input
                            id={`${baseId}-name`}
                            value={listPlan.name}
                            onChange={(event) => updateList(folderIndex, listIndex, {
                              mode: "create",
                              name: event.target.value,
                            })}
                          />
                        </div>
                      )}

                      {listPlan.mode === "existing" && (
                        <div className="grid gap-3 md:grid-cols-2">
                          <div>
                            <Label htmlFor={`${baseId}-list`}>Lista</Label>
                            <Select
                              value={listPlan.listId}
                              onValueChange={(listId) => updateList(folderIndex, listIndex, {
                                ...listPlan,
                                listId,
                              })}
                            >
                              <SelectTrigger id={`${baseId}-list`}>
                                <SelectValue placeholder="Escolha uma lista" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableLists.map((existingList) => (
                                  <SelectItem key={existingList.id} value={existingList.id}>
                                    {existingList.title}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor={`${baseId}-strategy`}>Ação</Label>
                            <Select
                              value={listPlan.strategy ?? "append"}
                              onValueChange={(strategy) => updateList(folderIndex, listIndex, {
                                ...listPlan,
                                strategy: strategy as "append" | "replace",
                              })}
                            >
                              <SelectTrigger id={`${baseId}-strategy`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="append">Adicionar os novos cards</SelectItem>
                                <SelectItem value="replace">Substituir os cards existentes</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      {listPlan.mode === "existing" && listPlan.strategy === "replace" && (
                        <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <span>O conteúdo da lista escolhida será substituído somente após confirmação explícita.</span>
                        </p>
                      )}
                    </article>
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
