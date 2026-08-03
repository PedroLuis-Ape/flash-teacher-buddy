import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { describeStudyResume } from "@/features/study/lib/studyResume";
import { useLatestStudyResume } from "@/hooks/useLatestStudyResume";
import { buildStudyResumeRoute } from "@/features/study/lib/studyResumeRoute";

export function StudyResumeBanner() {
  const navigate = useNavigate();
  // Mesma fonte única usada pela Home.
  const { resume, dismiss } = useLatestStudyResume();
  const [isOpening, setIsOpening] = useState(false);
  const visibleSnapshot = resume;
  const resumeRoute = visibleSnapshot
    ? buildStudyResumeRoute({ path: visibleSnapshot.path, sessionId: visibleSnapshot.sessionId })
    : null;

  // Continuar pede a sessão exata; a sessionId viaja na URL (durável em PWA) e
  // também em location.state por compatibilidade.
  const handleContinue = useCallback(() => {
    if (isOpening || !resumeRoute || !visibleSnapshot) return;
    setIsOpening(true);
    navigate(resumeRoute, {
      state: {
        resumeSessionId: visibleSnapshot.sessionId,
        resumeResourceId: visibleSnapshot.resourceId,
        resumeGameMode: visibleSnapshot.gameMode,
      },
    });
  }, [isOpening, navigate, resumeRoute, visibleSnapshot]);

  if (!visibleSnapshot || !resumeRoute) return null;

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
            disabled={isOpening}
            className="w-auto shrink-0 px-3"
          >
            {isOpening ? "Abrindo..." : "Continuar"}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={dismiss}
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
