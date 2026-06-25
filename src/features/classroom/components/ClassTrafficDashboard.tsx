import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { TurmaEngagementPanel } from "@/features/classroom/components/TurmaEngagementPanel";

interface Props {
  turmaId: string;
}

interface MemberRow {
  id?: string;
  user_id: string;
  profiles?: {
    first_name?: string;
    ape_id?: string;
  } | null;
}

export function ClassTrafficDashboard({ turmaId }: Props) {
  const navigate = useNavigate();

  const membersQuery = useQuery({
    queryKey: ["turma-traffic-members", turmaId],
    queryFn: async (): Promise<MemberRow[]> => {
      const { data: members, error } = await supabase
        .from("turma_membros")
        .select("id,user_id")
        .eq("turma_id", turmaId);

      if (error) throw error;
      const memberRows = members ?? [];
      const userIds = Array.from(new Set(memberRows.map((row: any) => row.user_id).filter(Boolean)));

      if (userIds.length === 0) return [];

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id,first_name,ape_id")
        .in("id", userIds);

      if (profilesError) throw profilesError;
      const profileById = new Map((profiles ?? []).map((profile: any) => [profile.id, profile]));

      return memberRows.map((member: any) => ({
        id: member.id,
        user_id: member.user_id,
        profiles: profileById.get(member.user_id) ?? null,
      }));
    },
    retry: false,
    staleTime: 60_000,
  });

  return (
    <main className="mx-auto max-w-6xl space-y-3 px-3 py-3 sm:space-y-4 sm:px-4 sm:py-4 lg:px-8">
      <Card className="border-primary/20 bg-primary/[0.04] p-3 sm:p-4">
        <div className="flex items-start gap-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0"
            onClick={() => navigate(`/turmas/${turmaId}`)}
            aria-label="Voltar para a turma"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 text-lg font-bold sm:text-2xl">
              <BarChart3 className="h-5 w-5 shrink-0 text-primary sm:h-6 sm:w-6" />
              Relatório de tráfego
            </h1>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-sm">
              Veja quais atividades despertam mais interesse. Alunos com conta aparecem pelo nome; visitantes sem conta são exibidos apenas como totais anônimos.
            </p>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-primary/15 bg-background/70 p-2.5 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          O relatório não armazena IP, localização, e-mail nem identificação de visitantes sem conta.
        </div>
      </Card>

      {membersQuery.isError && (
        <Card className="border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          Não foi possível carregar os nomes dos alunos agora. Os totais anônimos e as métricas gerais continuam disponíveis.
        </Card>
      )}

      <TurmaEngagementPanel turmaId={turmaId} membros={membersQuery.data ?? []} />
    </main>
  );
}
