import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileJson, Loader2, SearchCheck, XCircle } from "lucide-react";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ExtractedTerm = {
  term: string;
  normalized: string;
  source: string;
};

type DuplicateReportRow = {
  term: string;
  normalized: string;
  jsonCount: number;
  accountCount: number;
  sources: string[];
};

type AccountTermRow = { term: string | null };

const MAX_TERMS_TO_CHECK = 20_000;
const ACCOUNT_PAGE_SIZE = 1000;

function normalizeTerm(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function cleanTerm(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  return cleaned ? cleaned : null;
}

function pushTerm(items: ExtractedTerm[], value: unknown, source: string) {
  const term = cleanTerm(value);
  if (!term) return;
  items.push({ term, normalized: normalizeTerm(term), source });
}

function extractTermsFromKnownShape(payload: any): ExtractedTerm[] {
  const items: ExtractedTerm[] = [];
  const folders = payload?.package?.folders;
  if (!Array.isArray(folders)) return items;

  folders.forEach((folder: any, folderIndex: number) => {
    const folderName = cleanTerm(folder?.name) ?? `Pasta ${folderIndex + 1}`;
    const lists = Array.isArray(folder?.lists) ? folder.lists : [];

    lists.forEach((list: any, listIndex: number) => {
      const listName = cleanTerm(list?.name) ?? `Lista ${listIndex + 1}`;
      const prefix = `${folderName} / ${listName}`;

      const glossary = Array.isArray(list?.glossary) ? list.glossary : [];
      glossary.forEach((entry: any, entryIndex: number) => {
        pushTerm(items, entry?.term ?? entry?.original_text, `${prefix} / glossário ${entryIndex + 1}`);
      });

      const cards = Array.isArray(list?.cards) ? list.cards : [];
      cards.forEach((card: any, cardIndex: number) => {
        if (card?.type === "layered" && Array.isArray(card?.layers)) {
          card.layers.forEach((layer: any, layerIndex: number) => {
            pushTerm(items, layer?.front, `${prefix} / grupo ${cardIndex + 1} / camada ${layerIndex + 1}`);
          });
          return;
        }
        pushTerm(items, card?.front, `${prefix} / card ${cardIndex + 1}`);
      });
    });
  });

  return items;
}

function extractTermsFallback(value: unknown, source = "JSON"): ExtractedTerm[] {
  const items: ExtractedTerm[] = [];

  const visit = (node: unknown, path: string) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    const record = node as Record<string, unknown>;
    pushTerm(items, record.front ?? record.term ?? record.original_text, path);
    Object.entries(record).forEach(([key, child]) => {
      if (["front", "term", "original_text"].includes(key)) return;
      visit(child, `${path}.${key}`);
    });
  };

  visit(value, source);
  return items;
}

function extractTermsFromJson(text: string): ExtractedTerm[] {
  const payload = JSON.parse(text);
  const known = extractTermsFromKnownShape(payload);
  const items = known.length > 0 ? known : extractTermsFallback(payload);
  return items.slice(0, MAX_TERMS_TO_CHECK);
}

async function loadAccountTermCounts(): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("flashcards")
      .select("term")
      .is("deleted_at", null)
      .range(from, from + ACCOUNT_PAGE_SIZE - 1);

    if (error) throw error;
    const rows = (data ?? []) as AccountTermRow[];
    rows.forEach((row) => {
      const term = cleanTerm(row.term);
      if (!term) return;
      const normalized = normalizeTerm(term);
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    });

    if (rows.length < ACCOUNT_PAGE_SIZE) break;
    from += ACCOUNT_PAGE_SIZE;
  }

  return counts;
}

function buildReport(terms: ExtractedTerm[], accountCounts: Map<string, number>): DuplicateReportRow[] {
  const grouped = new Map<string, DuplicateReportRow>();

  terms.forEach((item) => {
    const existing = grouped.get(item.normalized);
    if (existing) {
      existing.jsonCount += 1;
      if (existing.sources.length < 3) existing.sources.push(item.source);
      return;
    }

    grouped.set(item.normalized, {
      term: item.term,
      normalized: item.normalized,
      jsonCount: 1,
      accountCount: accountCounts.get(item.normalized) ?? 0,
      sources: [item.source],
    });
  });

  return Array.from(grouped.values()).sort((a, b) =>
    b.accountCount - a.accountCount || b.jsonCount - a.jsonCount || a.term.localeCompare(b.term),
  );
}

export default function TermChecker() {
  const [jsonText, setJsonText] = useState("");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<DuplicateReportRow[]>([]);
  const [lastTotalExtracted, setLastTotalExtracted] = useState(0);

  const stats = useMemo(() => {
    const accountRepeated = rows.filter((row) => row.accountCount > 0);
    const internalRepeated = rows.filter((row) => row.jsonCount > 1);
    const newTerms = rows.filter((row) => row.accountCount === 0);
    return {
      accountRepeated,
      internalRepeated,
      newTerms,
    };
  }, [rows]);

  const runCheck = async () => {
    if (!jsonText.trim()) {
      toast.error("Cole um JSON para verificar.");
      return;
    }

    setLoading(true);
    try {
      const terms = extractTermsFromJson(jsonText);
      if (terms.length === 0) {
        setRows([]);
        setLastTotalExtracted(0);
        toast.error("Nenhum termo foi encontrado no JSON.");
        return;
      }

      const accountCounts = await loadAccountTermCounts();
      const report = buildReport(terms, accountCounts);
      setRows(report);
      setLastTotalExtracted(terms.length);
      toast.success(`Checagem concluída: ${report.length.toLocaleString("pt-BR")} termo(s) único(s).`);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível verificar o JSON.");
    } finally {
      setLoading(false);
    }
  };

  const clear = () => {
    setJsonText("");
    setRows([]);
    setLastTotalExtracted(0);
  };

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Checagem geral de termos" showBack />
      <main className="container mx-auto max-w-6xl space-y-4 p-4 pb-24">
        <Card className="border-primary/25 bg-primary/5 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <SearchCheck className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-semibold">Checar termos repetidos</h1>
            <Badge variant="secondary">não importa nada</Badge>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            Cole um JSON do App Piteco. A ferramenta extrai os termos principais, compara com os cards da sua conta e mostra quantas vezes cada termo já aparece.
          </p>
        </Card>

        <Card className="space-y-3 p-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileJson className="h-4 w-4" />
            JSON para verificar
          </div>
          <Textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            placeholder="Cole aqui o JSON do importador..."
            className="min-h-[260px] font-mono text-xs"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={clear} disabled={loading || (!jsonText && rows.length === 0)}>
              Limpar
            </Button>
            <Button onClick={() => void runCheck()} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <SearchCheck className="mr-2 h-4 w-4" />}
              Verificar termos
            </Button>
          </div>
        </Card>

        {rows.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <Metric label="Termos lidos" value={lastTotalExtracted} />
              <Metric label="Únicos" value={rows.length} />
              <Metric label="Já existem" value={stats.accountRepeated.length} tone="warning" />
              <Metric label="Novos" value={stats.newTerms.length} tone="success" />
            </div>

            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <h2 className="font-semibold">Já existem na sua conta</h2>
                <Badge variant="outline">{stats.accountRepeated.length.toLocaleString("pt-BR")}</Badge>
              </div>
              <ResultTable rows={stats.accountRepeated} empty="Nenhum termo do JSON já existe na sua conta." />
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <XCircle className="h-5 w-5 text-destructive" />
                <h2 className="font-semibold">Repetidos dentro do próprio JSON</h2>
                <Badge variant="outline">{stats.internalRepeated.length.toLocaleString("pt-BR")}</Badge>
              </div>
              <ResultTable rows={stats.internalRepeated} empty="O próprio JSON não tem termos repetidos." showAccountCount={false} />
            </Card>

            <Card className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h2 className="font-semibold">Novos na sua conta</h2>
                <Badge variant="outline">{stats.newTerms.length.toLocaleString("pt-BR")}</Badge>
              </div>
              <ResultTable rows={stats.newTerms.slice(0, 300)} empty="Nenhum termo novo encontrado." />
              {stats.newTerms.length > 300 && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Mostrando 300 de {stats.newTerms.length.toLocaleString("pt-BR")} termos novos para manter a tela leve.
                </p>
              )}
            </Card>
          </>
        )}
      </main>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: "warning" | "success" }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={tone === "warning" ? "mt-1 text-2xl font-bold text-amber-600" : tone === "success" ? "mt-1 text-2xl font-bold text-emerald-600" : "mt-1 text-2xl font-bold"}>
        {value.toLocaleString("pt-BR")}
      </div>
    </Card>
  );
}

function ResultTable({ rows, empty, showAccountCount = true }: { rows: DuplicateReportRow[]; empty: string; showAccountCount?: boolean }) {
  if (rows.length === 0) {
    return <div className="rounded-lg border p-5 text-center text-sm text-muted-foreground">{empty}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Termo</th>
            {showAccountCount && <th className="px-3 py-2">Na conta</th>}
            <th className="px-3 py-2">No JSON</th>
            <th className="px-3 py-2">Origem no JSON</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.normalized} className="border-t">
              <td className="max-w-[260px] break-words px-3 py-2 font-medium">{row.term}</td>
              {showAccountCount && <td className="px-3 py-2">{row.accountCount.toLocaleString("pt-BR")}</td>}
              <td className="px-3 py-2">{row.jsonCount.toLocaleString("pt-BR")}</td>
              <td className="max-w-[360px] break-words px-3 py-2 text-xs text-muted-foreground">
                {row.sources.join("; ")}
                {row.jsonCount > row.sources.length && "..."}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
