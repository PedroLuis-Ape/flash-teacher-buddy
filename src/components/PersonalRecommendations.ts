import { Fragment, createElement } from "react";
import { useLocation } from "react-router-dom";
import { RecommendedTeacherSpotlight } from "@/components/RecommendedTeacherSpotlight.tsx";
import { TeacherFoldersShelf } from "@/components/TeacherFoldersShelf";

export function PersonalRecommendations() {
  const { pathname } = useLocation();
  const showFolders = pathname === "/dashboard" || pathname === "/folders";

  return createElement(
    Fragment,
    null,
    showFolders ? createElement(TeacherFoldersShelf) : null,
    createElement(RecommendedTeacherSpotlight, { privateArea: true }),
  );
}
