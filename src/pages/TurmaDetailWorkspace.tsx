import type { MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveTurmaViewMode } from "@/features/classroom/lib/turmaAccess";
import { AssignmentOrderManager } from "@/features/classroom/components/AssignmentOrderManager";
import { ClassroomLibraryActions } from "@/features/classroom/components/ClassroomLibraryActions";
import { TeacherClassNavigation } from "@/features/classroom/components/TeacherClassNavigation";
import { ClassTrafficDashboard } from "@/features/classroom/components/ClassTrafficDashboard";
import { ClassGlossaryManager } from "@/features/classroom/components/ClassGlossaryManager";
import { markPendingClassGlossaryContext } from "@/features/classroom/lib/classGlossary";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useTransitionTurmaMembership } from "@/features/classroom/hooks/useClassroomMembership";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import TurmaPrivateDetail from "@/pages/TurmaPrivateDetail";
import TurmaPublicPage from "@/pages/TurmaPublicPage";

function PendingTurmaMembership({
  turmaId,
  nome,
  status,
}: {
  turmaId: string;
  nome: string;
  status: "requested" | "invited";
}) {
  const navigate = useNavigate();
  const transition = useTransitionTurmaMembership();

  const action = status === "invited" ? "accept_invite" : "cancel_request";
  const label = status === "invited" ? "Aceitar convite" : "Cancelar solicitação";

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-lg space-y-4 p-6">
        <div>
          <h1 className="text-xl font-semibold">{nome}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {status === "invited"
              ? "Você recebeu um convite para esta turma. Aceite para liberar o acesso privado."
              : "Sua solicitação está aguardando aprovação do professor."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={transition.isPending}
            onClick={() => void transition.mutateAsync({ turmaId, action })}
          >
            {transition.isPending ? "Processando..." : label}
          </Button>
          {status === "invited" && (
            <Button
              variant="outline"
              disabled={transition.isPending}
              onClick={() => void transition.mutateAsync({ turmaId, action: "reject_invite" })}
            >
              Recusar convite
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate("/turmas")}>Voltar</Button>
        </div>
        {transition.isError && (
          <p className="text-sm text-destructive">Não foi possível atualizar o vínculo. Tente novamente.</p>
        )}
      </Card>
    </div>
  );
}

export default function TurmaDetailWorkspace() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const [params] = useSearchParams();
  const { user, isLoading: authLoading } = useAuthUser();
  const publicPreview = params.get("publicPreview") === "true";
  const access = useQuery({
    queryKey: ["turma-access-gate", turmaId, user?.id, publicPreview],
    queryFn: async () => {
      if (!turmaId || !user) return null;
      const { data, error } = await (supabase.rpc as any)("get_turma_access_v1", {
        p_turma_id: turmaId,
      });
      if (!error) return data?.[0] ?? null;

      // Keep already-authorized classrooms reachable while the additive RPC
      // migration is rolling out. Pending private memberships intentionally do
      // not use this fallback because the legacy query cannot expose them.
      const missingRpc = error.code === "PGRST202"
        || error.code === "42883"
        || error.message?.toLowerCase().includes("get_turma_access_v1");
      if (!missingRpc) throw error;

      const legacy = await supabase
        .from("turmas")
        .select("id,nome,owner_teacher_id,public")
        .eq("id", turmaId)
        .maybeSingle();
      if (legacy.error) throw legacy.error;
      if (!legacy.data) return null;
      return {
        turma_id: legacy.data.id,
        nome: legacy.data.nome,
        owner_teacher_id: legacy.data.owner_teacher_id,
        is_public: legacy.data.public,
        membership_status: "active",
      };
    },
    enabled: Boolean(turmaId && user && !authLoading && !publicPreview),
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });

  if (authLoading || (user && access.isLoading && !access.data)) return <div className="min-h-screen grid place-items-center">Carregando turma...</div>;
  if (
    access.data &&
    access.data.is_public === false &&
    (access.data.membership_status === "requested" || access.data.membership_status === "invited")
  ) {
    return <PendingTurmaMembership turmaId={turmaId!} nome={access.data.nome} status={access.data.membership_status} />;
  }

  const mode = resolveTurmaViewMode({
    publicPreview,
    authenticated: Boolean(user),
    hasPrivateAccess: Boolean(access.data && access.data.membership_status === "active"),
  });
  if (mode !== "private") return <TurmaPublicPage />;

  const isOwner = Boolean(user && access.data?.owner_teacher_id === user.id);
  const selectedTab = params.get("tab");
  const trafficView = isOwner && selectedTab === "trafego";
  const glossaryView = isOwner && selectedTab === "glossario";

  const rememberClassContext = (event: MouseEvent<HTMLDivElement>) => {
    if (!turmaId) return;
    const target = event.target as HTMLElement;
    if (target.closest(".cursor-pointer,button,a,[role='button']")) {
      markPendingClassGlossaryContext(turmaId);
    }
  };

  return (
    <>
      {isOwner && <TeacherClassNavigation />}
      {glossaryView && turmaId ? (
        <ClassGlossaryManager turmaId={turmaId} turmaTitle={access.data?.nome ?? "Turma"} />
      ) : trafficView && turmaId ? (
        <ClassTrafficDashboard turmaId={turmaId} />
      ) : (
        <>
          {isOwner && turmaId && <ClassroomLibraryActions turmaId={turmaId} />}
          <div data-classroom-assignments onClickCapture={rememberClassContext}>
            <TurmaPrivateDetail />
          </div>
          {isOwner && turmaId && <AssignmentOrderManager turmaId={turmaId} />}
        </>
      )}
    </>
  );
}
