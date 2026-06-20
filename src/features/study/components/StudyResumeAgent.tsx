import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useOptionalInstitution } from "@/contexts/InstitutionContext";
import { isSafeStudyResumePath, writeStudyResume } from "@/features/study/lib/studyResume";

export function StudyResumeAgent() {
  const location = useLocation();
  const { user } = useAuthUser();
  const institution = useOptionalInstitution();
  const institutionId = institution?.selectedInstitution?.id ?? null;

  useEffect(() => {
    if (!user?.id) return;

    const path = `${location.pathname}${location.search}${location.hash}`;
    if (!isSafeStudyResumePath(path)) return;

    writeStudyResume(user.id, path, institutionId);
  }, [institutionId, location.hash, location.pathname, location.search, user?.id]);

  return null;
}
