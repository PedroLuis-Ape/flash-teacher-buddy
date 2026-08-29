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
import { useTranslation } from "react-i18next";

function PendingTurmaMembership({
  turmaId,
  nome,
  status,
}: {
  turmaId: string;
  nome: string;
  status: "requested" | "invited";
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const transition = useTransitionTurmaMembership();

  const action = status === "invited" ? "accept_invite" : "cancel_request";
  const label = status === "invited" ? t("classes.detail.acceptInvite") : t("classes.detail.cancelRequest");

  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Card className="w-full max-w-lg space-y-4 p-6">
        <div>
          <h1 className="text-xl font-semibold">{nome}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {status === "invited"
              ? t("classes.detail.invitePendingInfo")
              : t("classes.detail.requestPendingInfo")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={transition.isPending}
            onClick={() => void transition.mutateAsync({ turmaId, action })}
          >
            {transition.isPending ? t("classes.detail.processing") : label}
          </Button>
          {status === "invited" && (
            <Button
              variant="outline"
              disabled={transition.isPending}
              onClick={() => void transition.mutateAsync({ turmaId, action: "reject_invite" })}
            >
              {t("classes.detail.rejectInvite")}
            </Button>
          )}
          <Button variant="ghost" onClick={() => navigate("/turmas")}>{t("common.back")}</Button>
        </div>
        {transition.isError && (
          <p className="text-sm text-destructive">{t("classes.detail.membershipUpdateFailed")}</p>
        )}
      </Card>
    </div>
  );
}

export default function TurmaDetailWorkspace() {
  const { t } = useTranslation();
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

  if (authLoading || (user && access.isLoading && !access.data)) return <div className="min-h-screen grid place-items-center">{t("classes.detail.loadingClass")}</div>;
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
        <ClassGlossaryManager turmaId={turmaId} turmaTitle={access.data?.nome ?? t("classes.detail.classFallback")} />
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
