import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useInstitution } from "@/contexts/InstitutionContext";
import { describeStudyResume } from "@/features/study/lib/studyResume";
import {
  clearStudyResumePointer,
  readStudyResumePointer,
  studyResumePointerMatchesInstitution,
  type StudyResumeSnapshotV2,
} from "@/features/study/lib/studyResumePointer";

export function StudyResumeBanner() {
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const { selectedInstitution } = useInstitution();
  const institutionId = selectedInstitution?.id ?? null;
  const [dismissed, setDismissed] = useState(false);
  const [snapshot, setSnapshot] = useState<StudyResumeSnapshotV2 | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setSnapshot(null);
      return;
    }

    setDismissed(false);
    // A conclusão é avaliada pela própria sessionId do ponteiro (dentro de
    // readStudyResumePointer). Não usamos mais o preset global de outro modo
    // para decidir se esta sessão terminou.
    setSnapshot(readStudyResumePointer(user.id));
  }, [institutionId, user?.id]);

  const visibleSnapshot = useMemo(() => {
    if (dismissed || !snapshot) return null;
    return studyResumePointerMatchesInstitution(snapshot, institutionId) ? snapshot : null;
  }, [dismissed, institutionId, snapshot]);

  if (!visibleSnapshot || !user?.id) return null;

  const handleDismiss = () => {
    clearStudyResumePointer(user.id);
    setDismissed(true);
  };

  // Continuar pede a sessão exata; o engine valida usuário/lista/modo antes de
  // aceitá-la e não abre "a mais recente" como substituta.
  const handleContinue = () => {
    navigate(visibleSnapshot.path, {
      state: {
        resumeSessionId: visibleSnapshot.sessionId,
        resumeResourceId: visibleSnapshot.resourceId,
        resumeGameMode: visibleSnapshot.gameMode,
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 pt-4 lg:px-8 xl:px-12">
      <Card className="border-primary/20 bg-primary/5 shadow-sm">
        <CardContent className="flex items-center gap-3 p-3 sm:p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Play className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Continuar de onde você parou</p>
            <p className="truncate text-xs text-muted-foreground">
              {describeStudyResume(visibleSnapshot.path)}
            </p>
          </div>
          <Button
            size="sm"
            onClick={handleContinue}
            className="w-auto shrink-0 px-3"
          >
            Continuar
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDismiss}
            aria-label="Ocultar retomada de estudo"
            className="h-9 w-9 shrink-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
