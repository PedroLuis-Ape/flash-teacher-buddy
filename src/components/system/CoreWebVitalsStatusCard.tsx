import { useEffect, useMemo, useState } from "react";
import { Activity, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CORE_WEB_VITAL_EVENT,
  getLatestCoreWebVitals,
  type CoreWebVitalName,
  type CoreWebVitalRating,
  type CoreWebVitalsSnapshot,
} from "@/lib/coreWebVitalsRum";

const METRICS: Array<{
  name: CoreWebVitalName;
  label: string;
  description: string;
  target: string;
}> = [
  { name: "LCP", label: "LCP", description: "Maior conteúdo visível", target: "bom até 2,5 s" },
  { name: "INP", label: "INP", description: "Resposta às interações", target: "bom até 200 ms" },
  { name: "CLS", label: "CLS", description: "Estabilidade visual", target: "bom até 0,1" },
];

function ratingLabel(rating: CoreWebVitalRating) {
  if (rating === "good") return "Bom";
  if (rating === "needs-improvement") return "A melhorar";
  return "Ruim";
}

function ratingVariant(rating: CoreWebVitalRating): "default" | "secondary" | "destructive" {
  if (rating === "good") return "default";
  if (rating === "needs-improvement") return "secondary";
  return "destructive";
}

function formatValue(metric: CoreWebVitalName, value: number) {
  if (metric === "CLS") return value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  if (metric === "LCP") return `${(value / 1000).toFixed(2)} s`;
  return `${Math.round(value)} ms`;
}

export function CoreWebVitalsStatusCard() {
  const [snapshot, setSnapshot] = useState<CoreWebVitalsSnapshot | null>(() => getLatestCoreWebVitals());

  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<CoreWebVitalsSnapshot>).detail;
      setSnapshot(detail ?? getLatestCoreWebVitals());
    };
    window.addEventListener(CORE_WEB_VITAL_EVENT, update);
    setSnapshot(getLatestCoreWebVitals());
    return () => window.removeEventListener(CORE_WEB_VITAL_EVENT, update);
  }, []);

  const observedCount = useMemo(
    () => METRICS.filter((metric) => snapshot?.metrics[metric.name]).length,
    [snapshot],
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Core Web Vitals desta sessão
            </CardTitle>
            <CardDescription>
              Diagnóstico local do documento atual, sem identificação de usuário.
            </CardDescription>
          </div>
          <Badge variant={snapshot?.sampled ? "default" : "outline"}>
            {snapshot?.sampled ? "Sessão amostrada" : "Somente local"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-3">
          {METRICS.map((metric) => {
            const value = snapshot?.metrics[metric.name];
            return (
              <div key={metric.name} className="rounded-xl border border-border bg-muted/25 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black">{metric.label}</span>
                  {value ? (
                    <Badge variant={ratingVariant(value.rating)}>{ratingLabel(value.rating)}</Badge>
                  ) : (
                    <Badge variant="outline">Aguardando</Badge>
                  )}
                </div>
                <p className="mt-3 text-2xl font-black">{value ? formatValue(metric.name, value.value) : "—"}</p>
                <p className="mt-1 text-sm text-muted-foreground">{metric.description}</p>
                <p className="mt-2 text-xs font-semibold text-muted-foreground">{metric.target}</p>
              </div>
            );
          })}
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {observedCount === 0
              ? "LCP aparece após o carregamento; INP exige pelo menos uma interação e CLS só muda quando há deslocamento visual."
              : `${observedCount} de 3 métricas observadas nesta sessão.`}
            {" "}A avaliação de produção deve usar o percentil 75 agregado, separado por dispositivo — não apenas este valor individual.
          </p>
        </div>

        {snapshot && (
          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Rota normalizada</dt><dd className="font-mono text-xs">{snapshot.routeGroup}</dd></div>
            <div><dt className="text-muted-foreground">Dispositivo</dt><dd className="font-semibold">{snapshot.deviceClass}</dd></div>
            <div><dt className="text-muted-foreground">Navegação</dt><dd className="font-semibold">{snapshot.navigationType}</dd></div>
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
