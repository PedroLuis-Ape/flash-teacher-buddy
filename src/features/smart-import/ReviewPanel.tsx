import { useMemo } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { summarizeSmartImport, type SmartImportPackage } from "./schema";
import type { SmartImportSourceResult } from "./sourceParser";

function Count({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border p-3 text-center"><div className="text-xl font-bold">{value}</div><div className="text-xs text-muted-foreground">{label}</div></div>;
}

function normalizeTerm(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

interface ReviewPanelProps {
  parsed: SmartImportSourceResult;
  accountTermCounts?: Record<string, number>;
  loadingAccountDuplicates?: boolean;
  accountDuplicateError?: string;
}

export function ReviewPanel({
  parsed,
  accountTermCounts = {},
  loadingAccountDuplicates = false,
  accountDuplicateError = "",
}: ReviewPanelProps) {
  const list = parsed.packageValue.package.folders[0]?.lists[0];
  const summary = summarizeSmartImport(parsed.packageValue);
  const normalCards = useMemo(() => list?.cards.filter((card) => card.type === "normal") ?? [], [list?.cards]);
  const jsonTermCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const card of normalCards) {
      if (card.type !== "normal") continue;
      const normalized = normalizeTerm(card.front);
      if (!normalized) continue;
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }
    return counts;
  }, [normalCards]);

  const accountDuplicateRows = useMemo(() => normalCards.filter((card) => {
    if (card.type !== "normal") return false;
    return (accountTermCounts[normalizeTerm(card.front)] ?? 0) > 0;
  }).length, [accountTermCounts, normalCards]);

  const repeatedJsonRows = useMemo(() => normalCards.filter((card) => {
    if (card.type !== "normal") return false;
    return (jsonTermCounts.get(normalizeTerm(card.front)) ?? 0) > 1;
  }).length, [jsonTermCounts, normalCards]);

  if (!list) return null;
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
      <Count label="Cards" value={summary.cards} />
      <Count label="Glossário" value={summary.glossaryEntries} />
      <Count label="Contextuais" value={summary.wordHints} />
      <Count label="Grupos" value={summary.layeredGroups} />
      <Count label="Explicações" value={summary.detailedCards} />
      <Count label="Já na conta" value={accountDuplicateRows} />
      <Count label="Repete no JSON" value={repeatedJsonRows} />
    </div>
    {parsed.warnings.length > 0 && <Alert><AlertTriangle className="h-4 w-4" /><AlertDescription>{parsed.warnings.length} aviso(s) de interpretação.</AlertDescription></Alert>}
    <Alert>
      {loadingAccountDuplicates ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
      <AlertDescription>
        Linhas vermelhas: termo já existe em alguma lista ou espaço do seu perfil. Linhas amarelas: termo repetido dentro do próprio JSON.
        {accountDuplicateError && <span className="block text-muted-foreground">Checagem geral indisponível: {accountDuplicateError}</span>}
      </AlertDescription>
    </Alert>
    <Tabs defaultValue="cards">
      <TabsList><TabsTrigger value="cards">Cards</TabsTrigger><TabsTrigger value="glossary">Glossário</TabsTrigger><TabsTrigger value="groups">Agrupados</TabsTrigger></TabsList>
      <TabsContent value="cards" className="space-y-2">
        {normalCards.slice(0, 100).map((card, index) => {
          if (card.type !== "normal") return null;
          const normalized = normalizeTerm(card.front);
          const accountCount = accountTermCounts[normalized] ?? 0;
          const inJsonCount = jsonTermCounts.get(normalized) ?? 1;
          const existsInAccount = accountCount > 0;
          const repeatsInJson = inJsonCount > 1;
          return (
            <div
              key={card.key || index}
              className={cn(
                "grid gap-2 rounded-lg border p-3 sm:grid-cols-2",
                existsInAccount && "border-destructive/70 bg-destructive/10",
                !existsInAccount && repeatsInJson && "border-amber-400/70 bg-amber-500/10",
              )}
            >
              <div className="min-w-0">
                <span className="break-words font-medium">{card.front}</span>
                {(existsInAccount || repeatsInJson) && <div className="mt-2 flex flex-wrap gap-1.5">
                  {existsInAccount && <Badge variant="destructive">Já existe {accountCount}x na conta</Badge>}
                  {repeatsInJson && <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-300">Repete {inJsonCount}x no JSON</Badge>}
                </div>}
              </div>
              <span className="break-words text-primary">{card.back}</span>
            </div>
          );
        })}
      </TabsContent>
      <TabsContent value="glossary" className="space-y-2">{list.glossary.slice(0, 200).map((entry, index) => <div key={`${entry.term}-${index}`} className="rounded-lg border p-3"><Badge variant="outline">{entry.side}</Badge> <strong>{entry.term}</strong> - {entry.translation}</div>)}</TabsContent>
      <TabsContent value="groups" className="space-y-2">{list.cards.filter(card => card.type === "layered").map((card, index) => card.type === "layered" && <div key={card.key || index} className="rounded-lg border p-3"><strong>{card.group_title}</strong><Badge className="ml-2" variant="secondary">{card.layers.length} frases</Badge></div>)}</TabsContent>
    </Tabs>
  </div>;
}

export function ConfirmPanel({ value }: { value: SmartImportPackage }) {
  const summary = summarizeSmartImport(value);
  return <div className="grid grid-cols-2 gap-2 sm:grid-cols-3"><Count label="Cards" value={summary.cards} /><Count label="Glossário" value={summary.glossaryEntries} /><Count label="Contextuais" value={summary.wordHints} /></div>;
}
