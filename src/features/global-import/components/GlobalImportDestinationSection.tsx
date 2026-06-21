import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ImportDestinationCatalog } from "../destination";
import type { ExistingListConflictPolicy, GlobalImportDestinationMode } from "../destinationModes";
import { BulkGlossaryImportPanel } from "./BulkGlossaryImportPanel";

interface Props {
  mode: GlobalImportDestinationMode;
  onModeChange: (mode: GlobalImportDestinationMode) => void;
  catalog: ImportDestinationCatalog | null;
  selectedFolderId: string;
  onSelectedFolderChange: (id: string) => void;
  newFolderName: string;
  onNewFolderNameChange: (name: string) => void;
  listConflictPolicy: ExistingListConflictPolicy;
  onListConflictPolicyChange: (policy: ExistingListConflictPolicy) => void;
}

export function GlobalImportDestinationSection(props: Props) {
  return (
    <div className="space-y-4">
      <details className="rounded-xl border bg-card">
        <summary className="cursor-pointer select-none p-4 font-medium">Destino e conflitos — opcional</summary>
        <Card className="space-y-5 border-0 p-5 shadow-none">
          <p className="text-sm text-muted-foreground">Por padrão, o aplicativo cria a estrutura encontrada no CSV.</p>
          <RadioGroup value={props.mode} onValueChange={(value) => props.onModeChange(value as GlobalImportDestinationMode)} className="grid gap-3 md:grid-cols-3">
            <ModeOption value="existing-folder" title="Pasta existente" description="Criar ou atualizar listas dentro dela." />
            <ModeOption value="new-folder" title="Nova pasta única" description="Você define um único destino." />
            <ModeOption value="from-file" title="Estrutura do CSV" description="Criar as pastas e listas declaradas." />
          </RadioGroup>

          {props.mode === "existing-folder" && (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Selecionar pasta</Label>
                <Select value={props.selectedFolderId} onValueChange={props.onSelectedFolderChange}>
                  <SelectTrigger><SelectValue placeholder="Escolha uma pasta" /></SelectTrigger>
                  <SelectContent>
                    {(props.catalog?.folders ?? []).map((folder) => (
                      <SelectItem key={folder.id} value={folder.id}>{folder.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quando uma lista já existir</Label>
                <Select value={props.listConflictPolicy} onValueChange={(value) => props.onListConflictPolicyChange(value as ExistingListConflictPolicy)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="append">Adicionar os novos cards</SelectItem>
                    <SelectItem value="replace">Substituir após confirmação explícita</SelectItem>
                    <SelectItem value="rename">Criar uma lista numerada</SelectItem>
                    <SelectItem value="skip">Ignorar a lista existente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {props.mode === "new-folder" && (
            <div>
              <Label htmlFor="new-global-folder">Nome da nova pasta</Label>
              <Input id="new-global-folder" value={props.newFolderName} onChange={(event) => props.onNewFolderNameChange(event.target.value)} placeholder="Digite o nome escolhido" />
            </div>
          )}

          {props.mode === "from-file" && (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              As pastas e listas serão lidas do CSV e poderão ser revisadas antes da confirmação.
            </p>
          )}
        </Card>
      </details>
      <BulkGlossaryImportPanel catalog={props.catalog} />
    </div>
  );
}

function ModeOption({ value, title, description }: { value: string; title: string; description: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border p-4">
      <RadioGroupItem value={value} className="mt-1" />
      <span><strong className="block">{title}</strong><span className="text-sm text-muted-foreground">{description}</span></span>
    </label>
  );
}
