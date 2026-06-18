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

export function DestinationMappingCard({ packageValue, catalog, plan, onChange }: Props) {
  const updateFolder = (folderIndex: number, value: string) => {
    const current = plan.folders[folderIndex];
    const folder = packageValue.package.folders[folderIndex];
    const nextFolder = value === CREATE_FOLDER
      ? { mode: "create" as const, name: folder.name }
      : { mode: "existing" as const, folderId: value };

    const nextLists: Record<number, ListDestination> = {};
    folder.lists.forEach((list, listIndex) => {
      const previous = current?.lists[listIndex];
      if (nextFolder.mode === "create" || previous?.mode === "existing") {
        nextLists[listIndex] = { mode: "create", name: list.name };
      } else {
        nextLists[listIndex] = previous ?? { mode: "create", name: list.name };
      }
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
    onChange({
      ...plan,
      folders: {
        ...plan.folders,
        [folderIndex]: {
          ...folderPlan,
          lists: {
            ...folderPlan.lists,
            [listIndex]: value === CREATE_LIST
              ? { mode: "create", name: incomingList.name }
              : { mode: "existing", listId: value },
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
          Escolha o que será criado e o que será colocado dentro de pastas ou listas que já existem.
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
                  const selectedListId = listPlan.mode === "existing" ? listPlan.listId : CREATE_LIST;
                  return (
                    <div key={`${list.name}-${listIndex}`}>
                      <Label className="flex items-center gap-2">
                        <ListPlus className="h-3.5 w-3.5" />Lista recebida: {list.name}
                      </Label>
                      <Select
                        value={selectedListId}
                        onValueChange={(value) => updateList(folderIndex, listIndex, value)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value={CREATE_LIST}>
                            Criar nova lista “{list.name}” na pasta escolhida
                          </SelectItem>
                          {availableLists.map((existingList) => (
                            <SelectItem key={existingList.id} value={existingList.id}>
                              Usar lista existente: {existingList.title}
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
