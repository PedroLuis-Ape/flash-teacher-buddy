import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  BarChart3,
  BookOpen,
  Eye,
  Loader2,
  RefreshCw,
  Sparkles,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import {
  describeTurmaInterest,
  emptyTurmaEngagementReport,
  normalizeTurmaEngagementReport,
} from "@/features/classroom/lib/turmaEngagementReport";

interface Props {
  turmaId: string;
  membros: Array<{
    user_id: string;
    profiles?: { first_name?: string; ape_id?: string } | null;
  }>;
}

interface LiveActivity {
  student_id: string;
  list_id: string | null;
  mode: string | null;
  progress_pct: number;
  last_activity_at: string;
  list_title?: string | null;
}

const signalClass = {
  none: "border-muted bg-muted/30",
  low: "border-amber-500/30 bg-amber-500/10",
  moderate: "border-sky-500/30 bg-sky-500/10",
  high: "border-emerald-500/30 bg-emerald-500/10",
} as const;

function relativeTime(value?: string | null) {
  if (!value) return "Sem atividade";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sem atividade";
  return formatDistanceToNow(date, { addSuffix: true, locale: ptBR });
}

export function TurmaEngagementPanel({ turmaId, membros }: Props) {
  const [days, setDays] = useState(30);

  const reportQuery = useQuery({
    queryKey: ["turma-engagement-report", turmaId, days],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_turma_engagement_report_v1", {
        _turma_id: turmaId,
        _days: days,
      });
      if (error) {
        const message = String(error.message ?? "");
        if (/does not exist|could not find the function|schema cache/iu.test(message)) {
          return { available: false, report: emptyTurmaEngagementReport(days) };
        }
        throw error;
      }
      return { available: true, report: normalizeTurmaEngagementReport(data, days) };
    },
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const liveQuery = useQuery({
    queryKey: ["turma-live-activity", turmaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("turma_student_activity" as any)
        .select("*")
        .eq("turma_id", turmaId)
        .order("last_activity_at", { ascending: false });
      if (error) return [] as LiveActivity[];

      const ids = Array.from(new Set((data ?? []).map((row: any) => row.list_id).filter(Boolean)));
      let titles = new Map<string, string>();
      if (ids.length > 0) {
        const { data: lists } = await supabase.from("lists").select("id, title").in("id", ids);
        titles = new Map((lists ?? []).map((list: any) => [list.id, list.title]));
      }
      return (data ?? []).map((row: any) => ({
        ...row,
        list_title: row.list_id ? titles.get(row.list_id) ?? "Lista" : null,
      })) as LiveActivity[];
    },
    refetchInterval: 15_000,
  });

  const report = reportQuery.data?.report ?? emptyTurmaEngagementReport(days);
  const signal = describeTurmaInterest(report.summary);
  const liveMap = useMemo(
    () => new Map((liveQuery.data ?? []).map((row) => [row.student_id, row])),
    [liveQuery.data],
  );
  const studentsMap = useMemo(
    () => new Map(report.students.map((row) => [row.user_id, row])),
    [report.students],
  );
  const completion = report.summary.sessions > 0
    ? Math.round((report.summary.completed_sessions / report.summary.sessions) * 100)
    : 0;

  if (reportQuery.isLoading && liveQuery.isLoading) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline h-5 w-5 animate-spin" />
        Carregando interesse da turma...
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="flex items-center gap-2 font-semibold">
            <BarChart3 className="h-4 w-4" /> Interesse e atividade
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Alunos com conta aparecem pelo nome; acessos sem conta entram apenas nos totais.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={String(days)} onValueChange={(value) => setDays(Number(value))}>
            <SelectTrigger className="w-[138px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            aria-label="Atualizar métricas"
            onClick={() => {
              void reportQuery.refetch();
              void liveQuery.refetch();
            }}
          >
            <RefreshCw className={`h-4 w-4 ${reportQuery.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      {reportQuery.data?.available === false && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          As métricas detalhadas serão ativadas assim que a migration do painel for publicada.
        </div>
      )}

      <section className={`rounded-xl border p-4 ${signalClass[signal.level]}`}>
        <div className="flex gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">{signal.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{signal.description}</p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        {[
          [Users, report.summary.total_visitors, "Pessoas alcançadas"],
          [UserRound, report.summary.registered_visitors, "Com conta"],
          [Eye, report.summary.guest_visitors, "Sem conta"],
          [Activity, report.summary.sessions, "Sessões"],
          [BookOpen, report.summary.card_views, "Cards praticados"],
        ].map(([Icon, value, label], index) => {
          const MetricIcon = Icon as typeof Users;
          return (
            <div key={String(label)} className={`rounded-lg border bg-muted/20 p-3 ${index === 4 ? "col-span-2 lg:col-span-1" : ""}`}>
              <MetricIcon className="h-4 w-4 text-primary" />
              <p className="mt-2 text-2xl font-bold">{String(value)}</p>
              <p className="text-xs text-muted-foreground">{String(label)}</p>
            </div>
          );
        })}
      </section>

      {report.summary.sessions > 0 && (
        <section className="space-y-2 rounded-lg border p-3">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Sessões concluídas</span>
            <span className="text-muted-foreground">{completion}%</span>
          </div>
          <Progress value={completion} className="h-2" />
          <p className="text-xs text-muted-foreground">
            {report.summary.completed_sessions} de {report.summary.sessions} sessões chegaram ao fim.
          </p>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="space-y-2">
          <h4 className="font-medium">Listas mais praticadas</h4>
          {report.top_lists.length === 0 ? (
            <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Ainda sem dados.</p>
          ) : report.top_lists.slice(0, 5).map((list, index) => (
            <div key={list.list_id} className="flex items-center gap-3 rounded-lg border p-3">
              <span className="font-mono text-xs text-primary">#{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{list.title}</p>
                <p className="text-xs text-muted-foreground">{list.unique_visitors} pessoa(s) · {list.sessions} sessão(ões)</p>
              </div>
              <Badge variant="secondary">{list.card_views} cards</Badge>
            </div>
          ))}
        </section>

        <section className="space-y-2">
          <h4 className="font-medium">Cards mais praticados</h4>
          {report.top_cards.length === 0 ? (
            <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Os cards mais vistos aparecerão aqui.</p>
          ) : report.top_cards.slice(0, 5).map((card, index) => (
            <div key={card.card_id} className="rounded-lg border p-3">
              <div className="flex gap-3">
                <span className="font-mono text-xs text-violet-600">#{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm font-medium">{card.term || "Card sem texto"}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{card.translation}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{card.list_title}</p>
                </div>
                <Badge variant="secondary">{card.views}×</Badge>
              </div>
            </div>
          ))}
        </section>
      </div>

      <section className="space-y-2">
        <h4 className="font-medium">Alunos com conta</h4>
        {membros.length === 0 ? (
          <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Nenhum aluno inscrito.</p>
        ) : membros.map((membro) => {
          const student = studentsMap.get(membro.user_id);
          const live = liveMap.get(membro.user_id);
          const activeNow = live
            ? Date.now() - new Date(live.last_activity_at).getTime() <= 120_000
            : false;
          const last = student?.last_activity_at ?? live?.last_activity_at ?? null;
          return (
            <div key={membro.user_id} className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium">{membro.profiles?.first_name || student?.first_name || "Aluno"}</p>
                  {activeNow && <Badge className="bg-emerald-500/15 text-emerald-600">Estudando agora</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {membro.profiles?.ape_id ? `@${membro.profiles.ape_id} · ` : ""}{relativeTime(last)}
                </p>
                {live?.list_title && <p className="mt-1 text-xs text-muted-foreground">Agora: {live.list_title}</p>}
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{student?.sessions ?? 0} sessões</Badge>
                <Badge variant="outline">{student?.card_views ?? 0} cards</Badge>
              </div>
            </div>
          );
        })}
      </section>

      <p className="border-t pt-3 text-xs text-muted-foreground">
        Período analisado: {days} dias. Visitantes sem conta não têm nome ou perfil exibido.
      </p>
    </Card>
  );
}
