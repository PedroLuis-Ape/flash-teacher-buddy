import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props { value: string; onChange: (value: string) => void; onConfigure: () => void; }

export function SmartImportSourceStep({ value, onChange, onConfigure }: Props) {
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-3 rounded-lg border p-4">
      <div><h3 className="font-semibold">Gerar com IA</h3><p className="text-sm text-muted-foreground">Configure somente os recursos necessários.</p></div>
      <Button variant="outline" onClick={onConfigure}>Configurar prompt</Button>
    </div>
    <div className="space-y-2"><Label>Conteúdo</Label><Textarea value={value} onChange={(event) => onChange(event.target.value)} className="min-h-[420px] font-mono text-xs sm:text-sm" placeholder="Cole JSON 2.0, CSV ou texto estruturado..." /></div>
  </div>;
}
