import { useRef } from "react";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  value: string;
  busy: boolean;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  onFile: (file?: File) => void;
}

export function GlobalImportJsonSection({ value, busy, onChange, onAnalyze, onFile }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Label htmlFor="global-import-source">2. Importar conteúdo gerado</Label>
          <p className="text-sm text-muted-foreground">Cole o CSV da IA ou selecione um arquivo CSV de até 5 MB.</p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.txt,text/csv,application/json,text/plain"
            className="hidden"
            onChange={(event) => {
              onFile(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="mr-2 h-4 w-4" />Selecionar arquivo CSV
          </Button>
        </div>
      </div>
      <Textarea
        id="global-import-source"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-64 font-mono text-xs"
        disabled={busy}
        placeholder={'"folder_name","list_name","front","back"'}
      />
      <p className="text-xs text-muted-foreground">Pacotes JSON antigos continuam aceitos por compatibilidade.</p>
      <Button className="w-full" onClick={onAnalyze} disabled={!value.trim() || busy}>
        Validar e visualizar
      </Button>
    </Card>
  );
}
