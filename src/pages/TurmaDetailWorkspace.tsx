import type { MouseEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { resolveTurmaViewMode } from "@/features/classroom/lib/turmaAccess";
import { AssignmentOrderManager } from "@/features/classroom/components/AssignmentOrderManager";
import { ClassroomLibraryActions } from "@/features/classroom/components/ClassroomLibraryActions";
import { TeacherClassNavigation } from "@/features/classroom/components/TeacherClassNavigation";
import { ClassTrafficDashboard } from "@/features/classroom/components/ClassTrafficDashboard";
import { ClassGlossaryManager } from "@/features/classroom/components/ClassGlossaryManager";
import { markPendingClassGlossaryContext } from "@/features/classroom/lib/classGlossary";
import { useAuthUser } from "@/hooks/useAuthUser";
import TurmaPrivateDetail from "@/pages/TurmaPrivateDetail";
import TurmaPublicPage from "@/pages/TurmaPublicPage";

export default function TurmaDetailWorkspace() {
  const { turmaId } = useParams<{ turmaId: string }>();
  const [params] = useSearchParams();
  const { user, isLoading: authLoading } = useAuthUser();
  const publicPreview = params.get("publicPreview") === "true";
  const access = useQuery({
    queryKey: ["turma-access-gate", turmaId, user?.id, publicPreview],
    queryFn: async () => {
      if (!turmaId || !user) return null;
      const { data, error } = await supabase
        .from("turmas")
        .select("id,nome,owner_teacher_id")
        .eq("id", turmaId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(turmaId && user && !authLoading && !publicPreview),
    retry: false,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    placeholderData: (previous) => previous,
  });

  if (authLoading || (user && access.isLoading && !access.data)) return <div className="min-h-screen grid place-items-center">Carregando turma...</div>;
  const mode = resolveTurmaViewMode({ publicPreview, authenticated: Boolean(user), hasPrivateAccess: Boolean(access.data) });
  if (mode !== "private") return <TurmaPublicPage />;

  const isOwner = Boolean(user && access.data?.owner_teacher_id === user.id);
  const selectedTab = params.get("tab");
  const trafficView = isOwner && selectedTab === "trafego";
  const glossaryView = isOwner && selectedTab === "glossario";

  const rememberClassContext = (event: MouseEvent<HTMLDivElement>) => {
    if (!turmaId) return;
    const target = event.target as HTMLElement;
    if (target.closest("button,a,[role='button']")) {
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
