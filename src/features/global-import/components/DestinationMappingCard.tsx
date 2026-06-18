import { FolderInput, FolderPlus, ListPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { GlobalImportPackage } from "../schema";
import type {
  GlobalImportDestinationPlan,
  ImportDestinationCatalog,
  ListDestination,
} from "../destination";

interface Props {
  packageValue: GlobalImportPackage;
  catalog: ImportDestinationCatalog;
  plan: GlobalImportDestinationPlan;
  onChange: (plan: GlobalImportDestinationPlan) => void;
}

const CREATE_FOLDER = "__create_folder__";
const CREATE_LIST = "__create_list__";
const SKIP_LIST = "__skip_list__";

function listDestinationValue(destination: ListDestination): string {
  if (destination.mode === "skip") return SKIP_LIST;
  if (destination.mode === "create") return CREATE_LIST;
  return `${destination.strategy === "replace" ? "replace" : "append"}:${destination.listId}`;
}

export function DestinationMappingCard({ packageValue, catalog, plan, onChange }: Props) {
  const updateFolder = (folderIndex: number, value: string) => {
    const folder = packageValue.package.folders[folderIndex];
    const nextFolder = value === CREATE_FOLDER
      ? { mode: "create" as const, name: folder.name }
      : { mode: "existing" as const, folderId: value };

    const nextLists: Record<number, ListDestination> = {};
    folder.lists.forEach((list, listIndex) => {
      nextLists[listIndex] = { mode: "create", name: list.name };
    });

    onChange({
      ...plan,
      folders: {
        ...plan.folders,
        [folderIndex]: { folder: nextFolder, lists: nextLists },
      },
    });
  };

  const updateList = (folderIndex: number, listIndex: number, value: string) => {
    const folderPlan = plan.folders[folderIndex];
    const incomingList = packageValue.package.folders[folderIndex].lists[listIndex];
    let destination: ListDestination;
    if (value === CREATE_LIST) destination = { mode: "create", name: incomingList.name };
    else if (value === SKIP_LIST) destination = { mode: "skip" };
    else {
      const [strategy, listId] = value.split(":", 2);
      destination = {
        mode: "existing",
        listId,
        strategy: strategy === "replace" ? "replace" : "append",
      };
    }

    onChange({
      ...plan,
      folders: {
        ...plan.folders,
        [folderIndex]: {
          ...folderPlan,
          lists: {
            ...folderPlan.lists,
            [listIndex]: destination,
          },
        },
      },
    });
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-semibold">Destino da estrutura</h2>
        <p className="text-sm text-muted-foreground">
          Revise cada pasta e lista. Nada existente será substituído sem uma escolha explícita.
        </p>
      </div>

      <div className="space-y-4">
        {packageValue.package.folders.map((folder, folderIndex) => {
          const folderPlan = plan.folders[folderIndex];
          const selectedFolderId = folderPlan.folder.mode === "existing"
            ? folderPlan.folder.folderId
            : CREATE_FOLDER;
          const availableLists = folderPlan.folder.mode === "existing"
            ? catalog.lists.filter((list) => list.folder_id === folderPlan.folder.folderId)
            : [];

          return (
            <div key={`${folder.name}-${folderIndex}`} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center gap-2 font-medium">
                {folderPlan.folder.mode === "existing" ? <FolderInput className="h-4 w-4" /> : <FolderPlus className="h-4 w-4" />}
                Pasta recebida: {folder.name}
              </div>

              <Label>Destino da pasta</Label>
              <Select value={selectedFolderId} onValueChange={(value) => updateFolder(folderIndex, value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={CREATE_FOLDER}>Criar nova pasta “{folder.name}”</SelectItem>
                  {catalog.folders.map((existingFolder) => (
                    <SelectItem key={existingFolder.id} value={existingFolder.id}>
                      Usar pasta existente: {existingFolder.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="mt-4 space-y-3 border-l pl-4">
                {folder.lists.map((list, listIndex) => {
                  const listPlan = folderPlan.lists[listIndex];
                  const selectedValue = listDestinationValue(listPlan);
                  return (
                    <div key={`${list.name}-${listIndex}`}>
                      <Label className="flex items-center gap-2">
                        <ListPlus className="h-3.5 w-3.5" />Lista recebida: {list.name}
                      </Label>
                      <Select value={selectedValue} onValueChange={(value) => updateList(folderIndex, listIndex, value)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={CREATE_LIST}>Criar nova lista “{list.name}”</SelectItem>
                          <SelectItem value={SKIP_LIST}>Ignorar esta lista</SelectItem>
                          {availableLists.map((existingList) => (
                            <SelectItem key={`append:${existingList.id}`} value={`append:${existingList.id}`}>
                              Adicionar cards em: {existingList.title}
                            </SelectItem>
                          ))}
                          {availableLists.map((existingList) => (
                            <SelectItem key={`replace:${existingList.id}`} value={`replace:${existingList.id}`}>
                              Substituir conteúdo de: {existingList.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
