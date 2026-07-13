import { useEffect, useMemo, useState } from "react";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { CoreWebVitalsStatusCard } from "@/components/system/CoreWebVitalsStatusCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  createSystemHealthSnapshot,
  type BackendContractStatus,
  type RuntimeHostKind,
} from "@/lib/systemHealth";
import {
  describeBundleReport,
  parseBundleReport,
  type BundleReport,
} from "@/lib/bundleHealth";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Database,
  Gauge,
  Globe2,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";

const hostCopy: Record<RuntimeHostKind, { label: string; detail: string; ok: boolean }> = {
  canonical: { label: "Domínio canônico", detail: "A aplicação está em www.apeeducation.org.", ok: true },
  apex: { label: "Domínio raiz", detail: "Este acesso deveria redirecionar para www.", ok: false },
  preview: { label: "Ambiente de preview", detail: "Prévia isolada para validação.", ok: true },
  other: { label: "Host não reconhecido", detail: "Confirme se este endereço é autorizado.", ok: false },
};

const backendCopy: Record<BackendContractStatus, { label: string; detail: string; ok: boolean }> = {
  valid: {
    label: "Consistente",
    detail: "URL, projeto e chave publicável do frontend formam um contrato coerente.",
    ok: true,
  },
  missing: {
    label: "Configuração ausente",
    detail: "O build não recebeu todas as variáveis públicas obrigatórias do backend.",
    ok: false,
  },
  mismatch: {
    label: "Configuração divergente",
    detail: "Os componentes públicos do backend não pertencem ao mesmo projeto.",
    ok: false,
  },
  "invalid-url": {
    label: "URL inválida",
    detail: "O endereço compilado do backend não possui um formato válido.",
    ok: false,
  },
  "invalid-key": {
    label: "Chave inválida",
    detail: "A chave compilada não possui formato publicável ou role anônima.",
    ok: false,
  },
};

type BundleState =
  | { status: "loading" }
  | { status: "ready"; report: BundleReport }
  | { status: "unavailable" };

function StatusLine({ icon: Icon, title, value, detail, ok }: {
  icon: typeof Activity;
  title: string;
  value: string;
  detail: string;
  ok: boolean;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="mt-0.5 rounded-lg border bg-muted/40 p-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">{title}</p>
          <Badge variant={ok ? "secondary" : "destructive"}>{value}</Badge>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      </div>
    </div>
  );
}

export default function SystemStatusPage() {
  const [revision, setRevision] = useState(0);
  const [checkedAt, setCheckedAt] = useState(() => new Date());
  const [bundleState, setBundleState] = useState<BundleState>({ status: "loading" });

  const snapshot = useMemo(() => createSystemHealthSnapshot({
    hostname: window.location.hostname,
    isOnline: navigator.onLine,
    mode: import.meta.env.MODE,
    backendProjectId: import.meta.env.VITE_SUPABASE_PROJECT_ID,
    backendUrl: import.meta.env.VITE_SUPABASE_URL,
    backendPublishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  }), [revision]);

  useEffect(() => {
    let cancelled = false;
    setBundleState({ status: "loading" });

    void fetch(`/bundle-report.json?revision=${revision}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null;
        return parseBundleReport(await response.json());
      })
      .then((report) => {
        if (cancelled) return;
        setBundleState(report ? { status: "ready", report } : { status: "unavailable" });
      })
      .catch(() => {
        if (!cancelled) setBundleState({ status: "unavailable" });
      });

    return () => {
      cancelled = true;
    };
  }, [revision]);

  const host = hostCopy[snapshot.hostKind];
  const backend = backendCopy[snapshot.backendContract];
  const bundleOk = bundleState.status === "ready" && bundleState.report.status === "within-budget";
  const overallHealthy = host.ok && snapshot.isOnline && backend.ok && bundleOk;

  const bundleCopy = bundleState.status === "loading"
    ? { label: "Verificando", detail: "Carregando o relatório gerado pelo build.", ok: false }
    : bundleState.status === "unavailable"
      ? { label: "Indisponível", detail: "O relatório do bundle não foi encontrado neste ambiente.", ok: false }
      : {
          label: bundleState.report.status === "within-budget" ? "Dentro do orçamento" : "Acima do orçamento",
          detail: describeBundleReport(bundleState.report),
          ok: bundleState.report.status === "within-budget",
        };

  const refresh = () => {
    setCheckedAt(new Date());
    setRevision((current) => current + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Diagnóstico do sistema" showBack backPath="/" />
      <main className="mx-auto max-w-3xl space-y-5 p-4 pb-32">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {overallHealthy ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
                  Estado do ambiente
                </CardTitle>
                <CardDescription className="mt-1">Verificação segura do frontend, domínio, backend e tamanho do build.</CardDescription>
              </div>
              <Badge variant={overallHealthy ? "default" : "destructive"}>{overallHealthy ? "Operacional" : "Atenção"}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={refresh} className="w-full gap-2 sm:w-fit">
              <RefreshCw className="h-4 w-4" />
              Atualizar diagnóstico
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Última verificação: {checkedAt.toLocaleString("pt-BR")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ambiente e publicação</CardTitle>
            <CardDescription>Confirma a origem do frontend e os contratos essenciais do build publicado.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <StatusLine icon={Globe2} title="Host atual" value={host.label} detail={`${snapshot.hostname} — ${host.detail}`} ok={host.ok} />
            <StatusLine icon={snapshot.isOnline ? Wifi : WifiOff} title="Conectividade" value={snapshot.isOnline ? "Online" : "Offline"} detail="Sinal informado pelo navegador." ok={snapshot.isOnline} />
            <StatusLine icon={Activity} title="Modo do build" value={snapshot.mode} detail="Identifica como o bundle atual foi gerado." ok={snapshot.mode === "production"} />
            <StatusLine icon={Database} title="Contrato do backend" value={backend.label} detail={backend.detail} ok={backend.ok} />
            <StatusLine icon={Gauge} title="Orçamento do bundle" value={bundleCopy.label} detail={bundleCopy.detail} ok={bundleCopy.ok} />
          </CardContent>
        </Card>

        <CoreWebVitalsStatusCard />
      </main>
    </div>
  );
}
