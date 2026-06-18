import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function PrimaryPromptCard({ onCopy }: { onCopy: () => void }) {
  return <Card className="space-y-3 p-5"><h2 className="font-semibold">1. Criar conteúdo com IA</h2><p className="text-sm text-muted-foreground">Copie o prompt padrão, cole em uma IA e descreva naturalmente o conteúdo desejado.</p><Button className="w-full" onClick={onCopy}>Copiar prompt padrão</Button></Card>;
}
