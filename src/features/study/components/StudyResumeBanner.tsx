import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useInstitution } from "@/contexts/InstitutionContext";
import {
  clearStudyResume,
  describeStudyResume,
  readStudyResume,
  studyResumeMatchesInstitution,
  type StudyResumeSnapshot,
} from "@/features/study/lib/studyResume";

export function StudyResumeBanner() {
  const navigate = useNavigate();
  const { user } = useAuthUser();
  const { selectedInstitution } = useInstitution();
  const institutionId = selectedInstitution?.id ?? null;
  const [dismissed, setDismissed] = useState(false);
  const [snapshot, setSnapshot] = useState<StudyResumeSnapshot | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setSnapshot(null);
      return;
    }
    setDismissed(false);
    setSnapshot(readStudyResume(user.id));
  }, [institutionId, user?.id]);

  const visibleSnapshot = useMemo(() => {
    if (dismissed || !snapshot) return null;
    return studyResumeMatchesInstitution(snapshot, institutionId) ? snapshot : null;
  }, [dismissed, institutionId, snapshot]);

  if (!visibleSnapshot || !user?.id) return null;

  const handleDismiss = () => {
    clearStudyResume(user.id);
    setDismissed(true);
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
          <Button size="sm" onClick={() => navigate(visibleSnapshot.path)} className="shrink-0">
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
