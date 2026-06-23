import { FolderInput, FolderPlus, FolderTree } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ImportDestinationCatalog } from "../destination";
import type { ExistingListConflictPolicy, GlobalImportDestinationMode } from "../destinationModes";

interface Props {
  mode: GlobalImportDestinationMode;
  onModeChange: (value: GlobalImportDestinationMode) => void;
  catalog: ImportDestinationCatalog | null;
  selectedFolderId: string;
  onSelectedFolderChange: (value: string) => void;
  newFolderName: string;
  onNewFolderNameChange: (value: string) => void;
  listConflictPolicy: ExistingListConflictPolicy;
  onListConflictPolicyChange: (value: ExistingListConflictPolicy) => void;
}

export function StructuredDestinationPanel(props: Props) {
  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-start gap-3">
        <FolderTree className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold">Como o pacote deve ser organizado?</h3>
          <p className="text-sm text-muted-foreground">A estrutura pode ser preservada ou concentrada em uma única pasta.</p>
        </div>
      </div>
      <RadioGroup value={props.mode} onValueChange={(value) => props.onModeChange(value as GlobalImportDestinationMode)} className="grid gap-3 md:grid-cols-3">
        <ModeOption value="from-file" title="Usar estrutura do arquivo" description="Preserva e permite mapear cada pasta e lista depois da análise." icon={FolderTree} recommended />
        <ModeOption value="existing-folder" title="Usar uma pasta existente" description="Coloca todas as listas dentro da pasta escolhida." icon={FolderInput} />
        <ModeOption value="new-folder" title="Criar uma nova pasta" description="Reúne todas as listas em uma pasta com o nome escolhido." icon={FolderPlus} />
      </RadioGroup>

      {props.mode === "existing-folder" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Pasta existente</Label>
            <Select value={props.selectedFolderId} onValueChange={props.onSelectedFolderChange}>
              <SelectTrigger><SelectValue placeholder="Escolha uma pasta" /></SelectTrigger>
              <SelectContent>
                {(props.catalog?.folders ?? []).map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Quando uma lista com o mesmo nome já existir</Label>
            <Select value={props.listConflictPolicy} onValueChange={(value) => props.onListConflictPolicyChange(value as ExistingListConflictPolicy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="append">Adicionar os novos cards</SelectItem>
                <SelectItem value="replace">Substituir após confirmação</SelectItem>
                <SelectItem value="rename">Criar uma lista numerada</SelectItem>
                <SelectItem value="skip">Ignorar a lista existente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="md:col-span-2 rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
            A correspondência acontece pelo nome da lista dentro da pasta escolhida. Se o nome não existir, uma lista nova será criada.
          </p>
        </div>
      )}

      {props.mode === "new-folder" && (
        <div className="space-y-1.5">
          <Label htmlFor="v3-new-folder">Nome da nova pasta</Label>
          <Input id="v3-new-folder" value={props.newFolderName} onChange={(event) => props.onNewFolderNameChange(event.target.value)} placeholder="Digite o nome da pasta" />
        </div>
      )}

      {props.mode === "from-file" && (
        <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
          Depois da análise, você poderá escolher uma pasta e uma lista existente para cada parte recebida, criar novos destinos ou ignorar itens.
        </p>
      )}
    </Card>
  );
}

function ModeOption(props: {
  value: GlobalImportDestinationMode;
  title: string;
  description: string;
  icon: typeof FolderTree;
  recommended?: boolean;
}) {
  const Icon = props.icon;
  return (
    <Label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4 font-normal hover:bg-muted/40">
      <RadioGroupItem value={props.value} className="mt-1" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-primary" />{props.title}</span>
        <span className="mt-1 block text-sm text-muted-foreground">{props.description}</span>
        {props.recommended && <Badge className="mt-2" variant="secondary">Recomendado para pacotes completos</Badge>}
      </span>
    </Label>
  );
}
