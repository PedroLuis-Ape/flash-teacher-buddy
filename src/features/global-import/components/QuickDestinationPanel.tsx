import { ListPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ImportDestinationCatalog } from "../destination";
import type { QuickListStrategy } from "../quickListDestination";

interface Props {
  catalog: ImportDestinationCatalog | null;
  folderId: string;
  listId: string;
  strategy: QuickListStrategy;
  onFolderChange: (value: string) => void;
  onListChange: (value: string) => void;
  onStrategyChange: (value: QuickListStrategy) => void;
}

export function QuickDestinationPanel(props: Props) {
  const lists = (props.catalog?.lists ?? []).filter((list) => list.folder_id === props.folderId);
  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-start gap-3">
        <ListPlus className="mt-0.5 h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold">Destino direto em uma lista existente</h3>
          <p className="text-sm text-muted-foreground">Este fluxo aceita um pacote com exatamente uma pasta e uma lista e preserva cards normais ou em camadas.</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Pasta</Label>
          <Select value={props.folderId} onValueChange={props.onFolderChange}>
            <SelectTrigger><SelectValue placeholder="Escolha a pasta" /></SelectTrigger>
            <SelectContent>
              {(props.catalog?.folders ?? []).map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Lista que receberá os cards</Label>
          <Select value={props.listId} onValueChange={props.onListChange} disabled={!props.folderId}>
            <SelectTrigger><SelectValue placeholder={props.folderId ? "Escolha a lista" : "Escolha a pasta primeiro"} /></SelectTrigger>
            <SelectContent>
              {lists.map((list) => <SelectItem key={list.id} value={list.id}>{list.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>O que fazer com o conteúdo atual da lista?</Label>
        <Select value={props.strategy} onValueChange={(value) => props.onStrategyChange(value as QuickListStrategy)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="append">Adicionar os novos cards</SelectItem>
            <SelectItem value="replace">Substituir após confirmação</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {props.strategy === "replace" && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          A substituição remove o conteúdo atual da lista dentro da transação. Uma confirmação adicional será exibida antes de importar.
        </p>
      )}
      <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
        Nenhuma pasta ou lista nova será criada. Glossários presentes no contrato 2.0 continuam sendo enviados para a Caixa de Glossário central.
      </p>
    </Card>
  );
}
