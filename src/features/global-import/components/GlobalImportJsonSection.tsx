import { useRef } from "react";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
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

function normalizeEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function GlobalImportJsonSection({ value, busy, onChange, onAnalyze, onFile }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const ownerEmail = normalizeEmail(import.meta.env.VITE_OWNER_EMAIL);
  const ownerCanary = Boolean(ownerEmail && normalizeEmail(user?.email) === ownerEmail);

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Label htmlFor="global-import-source">Cole o JSON gerado</Label>
            {ownerCanary && <Badge variant="secondary">JSON oficial 2.0</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">Cole o JSON oficial da IA ou selecione um arquivo .json de até 10 MB.</p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept={ownerCanary ? ".json,application/json" : ".json,.txt,.csv,application/json,text/plain,text/csv"}
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (ownerCanary && file && !file.name.toLowerCase().endsWith(".json")) {
                toast.error("Nesta versão canário, selecione um arquivo JSON.");
                event.currentTarget.value = "";
                return;
              }
              onFile(file);
              event.currentTarget.value = "";
            }}
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="mr-2 h-4 w-4" />Selecionar arquivo JSON
          </Button>
        </div>
      </div>
      <Textarea
        id="global-import-source"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-64 font-mono text-xs"
        disabled={busy}
        placeholder={'{"schema":"app-piteco-super-import","version":"2.0",...}'}
      />
      <p className="text-xs text-muted-foreground">
        {ownerCanary
          ? "A versão canário trabalha com JSON 2.0 e corrige automaticamente alguns erros comuns de formatação antes de validar."
          : "CSV e pacotes JSON antigos continuam aceitos apenas por compatibilidade."}
      </p>
      <Button className="w-full" onClick={onAnalyze} disabled={!value.trim() || busy}>
        Analisar pacote
      </Button>
    </Card>
  );
}
