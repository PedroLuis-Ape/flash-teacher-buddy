import { useMemo, useState } from "react";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSystemHealthSnapshot, type RuntimeHostKind } from "@/lib/systemHealth";
import { Activity, AlertTriangle, CheckCircle2, Globe2, RefreshCw, Wifi, WifiOff } from "lucide-react";

const hostCopy: Record<RuntimeHostKind, { label: string; detail: string; ok: boolean }> = {
  canonical: { label: "Domínio canônico", detail: "A aplicação está em www.apeeducation.org.", ok: true },
  apex: { label: "Domínio raiz", detail: "Este acesso deveria redirecionar para www.", ok: false },
  preview: { label: "Ambiente de preview", detail: "Prévia isolada para validação.", ok: true },
  other: { label: "Host não reconhecido", detail: "Confirme se este endereço é autorizado.", ok: false },
};

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

  const snapshot = useMemo(() => createSystemHealthSnapshot({
    hostname: window.location.hostname,
    isOnline: navigator.onLine,
    mode: import.meta.env.MODE,
  }), [revision]);

  const host = hostCopy[snapshot.hostKind];
  const overallHealthy = host.ok && snapshot.isOnline;

  const refresh = () => {
    setCheckedAt(new Date());
    setRevision((current) => current + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Diagnóstico do sistema" showBack backPath="/" />
      <main className="mx-auto max-w-2xl space-y-5 p-4 pb-32">
        <Card>
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {overallHealthy ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <AlertTriangle className="h-5 w-5 text-destructive" />}
                  Estado do ambiente
                </CardTitle>
                <CardDescription className="mt-1">Verificação do frontend e do domínio atual.</CardDescription>
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
            <CardTitle className="text-base">Ambiente e domínio</CardTitle>
            <CardDescription>Confirma onde a interface está rodando.</CardDescription>
          </CardHeader>
          <CardContent className="divide-y">
            <StatusLine icon={Globe2} title="Host atual" value={host.label} detail={`${snapshot.hostname} — ${host.detail}`} ok={host.ok} />
            <StatusLine icon={snapshot.isOnline ? Wifi : WifiOff} title="Conectividade" value={snapshot.isOnline ? "Online" : "Offline"} detail="Sinal informado pelo navegador." ok={snapshot.isOnline} />
            <StatusLine icon={Activity} title="Modo do build" value={snapshot.mode} detail="Identifica como o bundle atual foi gerado." ok={snapshot.mode === "production"} />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
