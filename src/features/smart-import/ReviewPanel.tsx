import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { summarizeSmartImport, type SmartImportPackage } from "./schema";
import type { SmartImportSourceResult } from "./sourceParser";

function Count({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border p-3 text-center"><div className="text-xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}

export function ReviewPanel({ parsed }: { parsed: SmartImportSourceResult }) {
  const list = parsed.packageValue.package.folders[0]?.lists[0];
  const summary = summarizeSmartImport(parsed.packageValue);
  if (!list) return null;
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-5"><Count label="Cards" value={summary.cards} /><Count label="Glossário" value={summary.glossaryEntries} /><Count label="Contextuais" value={summary.wordHints} /><Count label="Grupos" value={summary.layeredGroups} /><Count label="Explicações" value={summary.detailedCards} /></div>
    {parsed.warnings.length > 0 && <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>{parsed.warnings.length} aviso(s) de interpretação.</AlertDescription></Alert>}
    <Tabs defaultValue="cards">
      <TabsList><TabsTrigger value="cards">Cards</TabsTrigger><TabsTrigger value="glossary">Glossário</TabsTrigger><TabsTrigger value="groups">Agrupados</TabsTrigger></TabsList>
      <TabsContent value="cards" className="space-y-2">{list.cards.filter(card => card.type === "normal").slice(0, 100).map((card, index) => card.type === "normal" && <div key={card.key || index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2"><span>{card.front}</span><span className="text-primary">{card.back}</span></div>)}</TabsContent>
      <TabsContent value="glossary" className="space-y-2">{list.glossary.slice(0, 200).map((entry, index) => <div key={`${entry.term}-${index}`} className="rounded-lg border p-3"><Badge variant="outline">{entry.side}</Badge> <strong>{entry.term}</strong> - {entry.translation}</div>)}</TabsContent>
      <TabsContent value="groups" className="space-y-2">{list.cards.filter(card => card.type === "layered").map((card, index) => card.type === "layered" && <div key={card.key || index} className="rounded-lg border p-3"><strong>{card.group_title}</strong><Badge className="ml-2" variant="secondary">{card.layers.length} frases</Badge></div>)}</TabsContent>
    </Tabs>
  </div>;
}

export function ConfirmPanel({ value }: { value: SmartImportPackage }) {
  const summary = summarizeSmartImport(value);
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><Count label="Cards" value={summary.cards} /><Count label="Glossário" value={summary.glossaryEntries} /><Count label="Contextuais" value={summary.wordHints} /></div>;
}
