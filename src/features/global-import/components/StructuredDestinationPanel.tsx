import { useEffect } from "react";
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
  useEffect(() => {
    if (props.mode === "from-file") props.onModeChange("existing-folder");
    if (props.listConflictPolicy === "append") props.onListConflictPolicyChange("rename");
    // Define somente os padrões iniciais seguros; escolhas feitas depois da montagem são preservadas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-start gap-3">
        <FolderTree className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold">Onde as listas devem ser criadas?</h3>
          <p className="text-sm text-muted-foreground">Cada lista do JSON será tratada separadamente.</p>
        </div>
      </div>
      <RadioGroup value={props.mode} onValueChange={(value) => props.onModeChange(value as GlobalImportDestinationMode)} className="grid gap-3 md:grid-cols-3">
        <ModeOption value="existing-folder" title="Dentro de uma pasta existente" description="Exemplo: 3 listas no JSON serão criadas ou reaproveitadas dentro da pasta escolhida." icon={FolderInput} recommended />
        <ModeOption value="new-folder" title="Dentro de uma nova pasta" description="Cria uma pasta e mantém todas as listas do JSON separadas dentro dela." icon={FolderPlus} />
        <ModeOption value="from-file" title="Usar toda a estrutura do arquivo" description="Preserva as pastas e listas do JSON e permite mapear cada destino depois." icon={FolderTree} />
      </RadioGroup>

      {props.mode === "existing-folder" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Pasta que receberá as listas</Label>
            <Select value={props.selectedFolderId} onValueChange={props.onSelectedFolderChange}>
              <SelectTrigger><SelectValue placeholder="Escolha a pasta existente" /></SelectTrigger>
              <SelectContent>
                {(props.catalog?.folders ?? []).map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Se já existir uma lista com o mesmo nome</Label>
            <Select value={props.listConflictPolicy} onValueChange={(value) => props.onListConflictPolicyChange(value as ExistingListConflictPolicy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="rename">Criar outra lista numerada — recomendado</SelectItem>
                <SelectItem value="append">Juntar os novos cards à lista existente</SelectItem>
                <SelectItem value="replace">Substituir a lista após confirmação</SelectItem>
                <SelectItem value="skip">Ignorar essa lista do JSON</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="md:col-span-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
            Regra prática: 3 listas no JSON geram 3 destinos dentro desta pasta. Uma lista só deixa de ser criada separadamente quando você escolhe juntar, substituir ou ignorar uma lista com o mesmo nome.
          </p>
        </div>
      )}

      {props.mode === "new-folder" && (
        <div className="space-y-1.5">
          <Label htmlFor="v3-new-folder">Nome da nova pasta</Label>
          <Input id="v3-new-folder" value={props.newFolderName} onChange={(event) => props.onNewFolderNameChange(event.target.value)} placeholder="Digite o nome da pasta" />
          <p className="text-sm text-muted-foreground">Todas as listas do JSON continuarão separadas dentro da nova pasta.</p>
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
        {props.recommended && <Badge className="mt-2" variant="secondary">Recomendado para várias listas</Badge>}
      </span>
    </Label>
  );
}
