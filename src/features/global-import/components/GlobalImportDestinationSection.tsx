import { AlertCircle, AlertTriangle, FolderOpen, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ImportDestinationCatalog } from "../destination";
import type { GlobalImportDestinationMode } from "../destinationModes";

interface Props {
  mode: GlobalImportDestinationMode;
  onModeChange: (mode: GlobalImportDestinationMode) => void;
  catalog: ImportDestinationCatalog | null;
  catalogLoading: boolean;
  catalogError: string | null;
  onRetryCatalog: () => void;
  contextLabel: string;
  selectedFolderId: string;
  onSelectedFolderChange: (id: string) => void;
  selectedListId: string;
  onSelectedListChange: (id: string) => void;
  selectedListStrategy: "append" | "replace";
  onSelectedListStrategyChange: (strategy: "append" | "replace") => void;
  newFolderName: string;
  onNewFolderNameChange: (name: string) => void;
}

const CREATE_NEW_LISTS = "__create_new_lists__";

export function GlobalImportDestinationSection(props: Props) {
  const selectedFolder = props.catalog?.folders.find(
    (folder) => folder.id === props.selectedFolderId,
  );
  const selectedLists = selectedFolder
    ? (props.catalog?.lists ?? []).filter((list) => list.folder_id === selectedFolder.id)
    : [];

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h2 className="font-semibold">1. Onde o conteúdo será salvo?</h2>
        <p className="text-sm text-muted-foreground">
          Biblioteca atual: <strong className="text-foreground">{props.contextLabel}</strong>.
          Somente destinos visíveis e graváveis neste contexto são exibidos.
        </p>
      </div>

      <RadioGroup
        value={props.mode}
        onValueChange={(value) => props.onModeChange(value as GlobalImportDestinationMode)}
        className="grid gap-3 md:grid-cols-3"
      >
        <ModeOption
          value="existing-folder"
          title="Usar uma pasta existente"
          description="Salvar dentro de uma pasta que já está na sua Biblioteca."
        />
        <ModeOption
          value="new-folder"
          title="Criar uma nova pasta"
          description="Criar uma pasta e salvar todas as listas importadas nela."
        />
        <ModeOption
          value="from-file"
          title="Manter a estrutura do arquivo"
          description="Criar ou reutilizar as pastas e listas declaradas no JSON, CSV ou texto."
        />
      </RadioGroup>

      {props.mode === "existing-folder" && (
        <div className="space-y-3">
          {props.catalogLoading && (
            <p className="flex items-center gap-2 rounded-lg bg-muted p-3 text-sm" role="status">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando suas pastas...
            </p>
          )}

          {!props.catalogLoading && props.catalogError && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <p className="flex items-start gap-2">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>Não foi possível carregar suas pastas. {props.catalogError}</span>
              </p>
              <Button type="button" variant="outline" size="sm" className="mt-3" onClick={props.onRetryCatalog}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>
            </div>
          )}

          {!props.catalogLoading && !props.catalogError && props.catalog?.folders.length === 0 && (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
              <p className="flex items-start gap-2">
                <FolderOpen className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Você ainda não possui pastas nesta Biblioteca. Crie uma pasta ou escolha “Criar uma nova pasta”.
                </span>
              </p>
            </div>
          )}

          {!props.catalogLoading && !props.catalogError && (props.catalog?.folders.length ?? 0) > 0 && (
            <div>
              <Label htmlFor="existing-import-folder">Selecionar pasta</Label>
              <Select value={props.selectedFolderId} onValueChange={props.onSelectedFolderChange}>
                <SelectTrigger id="existing-import-folder">
                  <SelectValue placeholder="Escolha uma pasta" />
                </SelectTrigger>
                <SelectContent>
                  {(props.catalog?.folders ?? []).map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>{folder.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedFolder && (
            <div className="rounded-lg border bg-muted/20 p-3 text-sm">
              <div><strong>Pasta escolhida:</strong> {selectedFolder.title}</div>
              <div className="mt-1 text-muted-foreground">
                {selectedLists.length} lista(s) disponível(is) nesta pasta
              </div>

              <div className="mt-4 space-y-3 border-t pt-3">
                <div>
                  <Label htmlFor="existing-import-list">Destino inicial dos novos cards</Label>
                  <Select
                    value={props.selectedListId || CREATE_NEW_LISTS}
                    onValueChange={(value) => props.onSelectedListChange(
                      value === CREATE_NEW_LISTS ? "" : value,
                    )}
                  >
                    <SelectTrigger id="existing-import-list">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={CREATE_NEW_LISTS}>
                        Criar novas listas com os nomes recebidos
                      </SelectItem>
                      {selectedLists.map((list) => (
                        <SelectItem key={list.id} value={list.id}>{list.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Depois da análise, você poderá ajustar separadamente o destino de cada lista recebida.
                  </p>
                </div>

                {props.selectedListId && (
                  <div>
                    <Label htmlFor="existing-import-list-strategy">Ação inicial</Label>
                    <Select
                      value={props.selectedListStrategy}
                      onValueChange={(value) => props.onSelectedListStrategyChange(
                        value as "append" | "replace",
                      )}
                    >
                      <SelectTrigger id="existing-import-list-strategy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="append">Adicionar os novos cards</SelectItem>
                        <SelectItem value="replace">Substituir os cards existentes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {props.selectedListId && props.selectedListStrategy === "replace" && (
                  <p className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      A substituição continuará bloqueada até a confirmação explícita no resumo final.
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {props.mode === "new-folder" && (
        <div>
          <Label htmlFor="new-global-folder">Nome da nova pasta</Label>
          <Input
            id="new-global-folder"
            value={props.newFolderName}
            onChange={(event) => props.onNewFolderNameChange(event.target.value)}
            placeholder="Digite o nome escolhido"
          />
        </div>
      )}

      {props.mode === "from-file" && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          As pastas e listas do arquivo poderão ser revisadas individualmente antes da confirmação.
        </p>
      )}
    </Card>
  );
}

function ModeOption({
  value,
  title,
  description,
}: {
  value: string;
  title: string;
  description: string;
}) {
  return (
    <label className="flex min-w-0 cursor-pointer items-start gap-3 rounded-lg border p-4 focus-within:ring-2 focus-within:ring-ring">
      <RadioGroupItem value={value} className="mt-1" />
      <span className="min-w-0">
        <strong className="block break-words">{title}</strong>
        <span className="text-sm text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}
