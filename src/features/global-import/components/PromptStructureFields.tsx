import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { GlobalImportDestinationMode } from "../destinationModes";
import { movePromptModelItem, newPromptFolder, newPromptList, type PromptFolderModel } from "./promptModels";

interface Props {
  mode: GlobalImportDestinationMode;
  folders: PromptFolderModel[];
  onChange: (folders: PromptFolderModel[]) => void;
}

export function PromptStructureFields({ mode, folders, onChange }: Props) {
  const updateFolder = (index: number, value: PromptFolderModel) => {
    onChange(folders.map((folder, folderIndex) => folderIndex === index ? value : folder));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Pastas, listas e cards</Label>
        {mode === "from-file" && <Button type="button" size="sm" variant="outline" onClick={() => onChange([...folders, newPromptFolder()])}>Adicionar pasta</Button>}
      </div>
      {folders.map((folder, folderIndex) => (
        <div key={folder.id} className="space-y-3 rounded-lg border p-3">
          <div className="flex flex-wrap gap-2">
            <Input className="min-w-48 flex-1" value={folder.name} disabled={mode !== "from-file"} onChange={(event) => updateFolder(folderIndex, { ...folder, name: event.target.value })} placeholder={mode === "from-file" ? "Nome da pasta" : "Pasta definida no destino"} />
            {mode === "from-file" && <MoveButtons index={folderIndex} length={folders.length} onMove={(target) => onChange(movePromptModelItem(folders, folderIndex, target))} />}
            {mode === "from-file" && <Button type="button" size="sm" variant="ghost" disabled={folders.length === 1} onClick={() => onChange(folders.filter((_, index) => index !== folderIndex))}>Remover</Button>}
          </div>
          {folder.lists.map((list, listIndex) => (
            <div key={list.id} className="grid gap-2 sm:grid-cols-[1fr_110px_auto_auto]">
              <Input value={list.name} onChange={(event) => updateFolder(folderIndex, { ...folder, lists: folder.lists.map((item, index) => index === listIndex ? { ...item, name: event.target.value } : item) })} placeholder="Nome da lista" />
              <Input type="number" min={1} max={5000} value={list.cardCount} onChange={(event) => updateFolder(folderIndex, { ...folder, lists: folder.lists.map((item, index) => index === listIndex ? { ...item, cardCount: Number(event.target.value) } : item) })} aria-label="Quantidade de cards" />
              <MoveButtons index={listIndex} length={folder.lists.length} onMove={(target) => updateFolder(folderIndex, { ...folder, lists: movePromptModelItem(folder.lists, listIndex, target) })} />
              <Button type="button" size="sm" variant="ghost" disabled={folder.lists.length === 1} onClick={() => updateFolder(folderIndex, { ...folder, lists: folder.lists.filter((_, index) => index !== listIndex) })}>Remover</Button>
            </div>
          ))}
          <Button type="button" size="sm" variant="ghost" onClick={() => updateFolder(folderIndex, { ...folder, lists: [...folder.lists, newPromptList()] })}>Adicionar lista</Button>
        </div>
      ))}
    </div>
  );
}

function MoveButtons({ index, length, onMove }: { index: number; length: number; onMove: (target: number) => void }) {
  return (
    <div className="flex gap-1">
      <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => onMove(index - 1)}>↑</Button>
      <Button type="button" size="sm" variant="ghost" disabled={index === length - 1} onClick={() => onMove(index + 1)}>↓</Button>
    </div>
  );
}
