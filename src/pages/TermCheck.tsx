import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, FileSearch, Loader2, Search, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";

interface ExtractedTerm {
  original: string;
  normalized: string;
  inJsonCount: number;
  existingCount: number;
}

const normalizeTerm = (value: string) => value.replace(/\s+/g, " ").trim().toLocaleLowerCase();

function addTerm(raw: unknown, map: Map<string, ExtractedTerm>) {
  if (typeof raw !== "string") return;
  const original = raw.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  const normalized = normalizeTerm(original);
  if (!normalized) return;
  const current = map.get(normalized);
  if (current) {
    current.inJsonCount += 1;
    return;
  }
  map.set(normalized, { original, normalized, inJsonCount: 1, existingCount: 0 });
}

function extractTermsFromJson(input: unknown): ExtractedTerm[] {
  const terms = new Map<string, ExtractedTerm>();

  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (typeof node !== "object") return;

    const obj = node as Record<string, unknown>;
    const type = typeof obj.type === "string" ? obj.type.toLowerCase() : "";

    if (typeof obj.front === "string") addTerm(obj.front, terms);
    else if (typeof obj.term === "string") addTerm(obj.term, terms);
    else if (type === "normal" && typeof obj.a === "string") addTerm(obj.a, terms);

    if (Array.isArray(obj.layers)) {
      obj.layers.forEach((layer) => {
        if (layer && typeof layer === "object") {
          const layerObj = layer as Record<string, unknown>;
          if (typeof layerObj.front === "string") addTerm(layerObj.front, terms);
          else if (typeof layerObj.term === "string") addTerm(layerObj.term, terms);
          else if (typeof layerObj.a === "string") addTerm(layerObj.a, terms);
        }
      });
    }

    Object.values(obj).forEach((value) => {
      if (value && typeof value === "object") walk(value);
    });
  };

  walk(input);
  return Array.from(terms.values()).sort((a, b) => a.normalized.localeCompare(b.normalized));
}

export default function TermCheck() {
  const navigate = useNavigate();
  const [jsonText, setJsonText] = useState("");
  const [checking, setChecking] = useState(false);
  const [results, setResults] = useState<ExtractedTerm[]>([]);

  const stats = useMemo(() => {
    const existing = results.filter((item) => item.existingCount > 0);
    const newTerms = results.filter((item) => item.existingCount === 0);
    const repeatedInsideJson = results.filter((item) => item.inJsonCount > 1);
    return { existing, newTerms, repeatedInsideJson };
  }, [results]);

  const handleCheck = async () => {
    if (!jsonText.trim()) {
      toast.error("Cole um JSON para verificar.");
      return;
    }

    setChecking(true);
    setResults([]);

    try {
      const parsed = JSON.parse(jsonText);
      const extracted = extractTermsFromJson(parsed);

      if (extracted.length === 0) {
        toast.error("Nenhum termo foi encontrado no JSON.");
        return;
      }

      const { data, error } = await (supabase as any).rpc("get_term_duplicate_counts", {
        p_terms: extracted.map((item) => item.original),
      });

      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of (data ?? []) as Array<{ normalized_term: string; existing_count: number | string }>) {
        counts.set(row.normalized_term, Number(row.existing_count ?? 0));
      }

      const withCounts = extracted.map((item) => ({
        ...item,
        existingCount: counts.get(item.normalized) ?? 0,
      }));

      setResults(withCounts);
      toast.success(`${withCounts.length.toLocaleString("pt-BR")} termo(s) verificado(s).`);
    } catch (error: any) {
      console.error("Term check error:", error);
      if (error instanceof SyntaxError) {
        toast.error("JSON inválido. Revise o texto colado.");
      } else {
        toast.error(error?.message || "Não foi possível checar os termos.");
      }
    } finally {
      setChecking(false);
    }
  };

  const clear = () => {
    setJsonText("");
    setResults([]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 pb-24">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Checagem geral de termos</h1>
              <p className="text-sm text-muted-foreground">Cole um JSON do App Piteco para saber quais termos já existem na sua conta.</p>
            </div>
          </div>
          <Badge variant="secondary" className="w-fit">Não importa nada</Badge>
        </div>

        <Card className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
            <FileSearch className="mt-0.5 h-5 w-5 shrink-0" />
            <p>
              Esta ferramenta só audita o JSON. Ela extrai os termos do lado principal dos cards, normaliza maiúsculas/minúsculas e consulta o banco para retornar quantas vezes cada termo já aparece.
            </p>
          </div>
          <Textarea
            value={jsonText}
            onChange={(event) => setJsonText(event.target.value)}
            placeholder="Cole aqui o JSON do importador..."
            className="min-h-[280px] font-mono text-xs"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={clear} disabled={checking || (!jsonText && results.length === 0)}>Limpar</Button>
            <Button onClick={handleCheck} disabled={checking || !jsonText.trim()}>
              {checking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Checar termos
            </Button>
          </div>
        </Card>

        {results.length > 0 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Termos verificados" value={results.length} />
              <Metric label="Já existem" value={stats.existing.length} />
              <Metric label="Novos" value={stats.newTerms.length} />
            </div>

            {stats.existing.length > 0 && (
              <ResultSection
                title="Já existem na sua conta"
                icon={<XCircle className="h-5 w-5 text-amber-500" />}
                items={stats.existing}
                countLabel="vez(es) na conta"
              />
            )}

            {stats.repeatedInsideJson.length > 0 && (
              <ResultSection
                title="Repetidos dentro do próprio JSON"
                icon={<FileSearch className="h-5 w-5 text-primary" />}
                items={stats.repeatedInsideJson}
                countLabel="vez(es) no JSON"
                useJsonCount
              />
            )}

            <ResultSection
              title="Novos"
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-500" />}
              items={stats.newTerms}
              countLabel="não encontrado"
              emptyText="Nenhum termo novo encontrado."
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-bold">{value.toLocaleString("pt-BR")}</div>
    </Card>
  );
}

function ResultSection({
  title,
  icon,
  items,
  countLabel,
  emptyText = "Nada para mostrar.",
  useJsonCount = false,
}: {
  title: string;
  icon: React.ReactNode;
  items: ExtractedTerm[];
  countLabel: string;
  emptyText?: string;
  useJsonCount?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center gap-2">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant="outline">{items.length.toLocaleString("pt-BR")}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto rounded-lg border">
          {items.map((item) => (
            <div key={item.normalized} className="flex flex-col gap-1 border-b p-3 last:border-b-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="break-words font-medium">{item.original}</div>
                {item.original.toLocaleLowerCase() !== item.normalized && <div className="text-xs text-muted-foreground">normalizado: {item.normalized}</div>}
              </div>
              <Badge variant={useJsonCount ? "secondary" : item.existingCount > 0 ? "destructive" : "outline"} className="w-fit">
                {useJsonCount ? item.inJsonCount : item.existingCount} {countLabel}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
