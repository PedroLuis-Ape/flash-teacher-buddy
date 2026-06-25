import { createElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useInstitution } from "@/contexts/InstitutionContext";

export function TeacherFoldersShelf() {
  const navigate = useNavigate();
  const { userId } = useAuthUser();
  const { selectedInstitution } = useInstitution();
  const institutionId = selectedInstitution?.id ?? null;

  const { data = [] } = useQuery({
    queryKey: ["teacher-folders-shelf", userId, institutionId ?? "general"],
    enabled: Boolean(userId),
    staleTime: 60_000,
    queryFn: async () => {
      const subscriptions = await supabase
        .from("subscriptions")
        .select("teacher_id")
        .eq("student_id", userId as string);
      if (subscriptions.error) throw subscriptions.error;

      const ids = [...new Set((subscriptions.data || []).map((item) => item.teacher_id).filter(Boolean))];
      if (ids.length === 0) return [];

      let query: any = supabase
        .from("folders")
        .select("id, title")
        .in("owner_id", ids)
        .eq("visibility", "class")
        .is("class_id", null)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(4);

      query = institutionId ? query.eq("institution_id", institutionId) : query.is("institution_id", null);
      const folders = await query;
      if (folders.error) throw folders.error;
      return folders.data || [];
    },
  });

  if (data.length === 0) return null;

  return createElement(
    "section",
    { className: "mb-5 space-y-3", "aria-label": "Pastas dos professores que você segue" },
    createElement("h2", { className: "text-lg font-semibold" }, "Pastas dos professores que você segue"),
    createElement(
      "div",
      { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4" },
      data.map((folder: any) => createElement(
        "button",
        {
          key: folder.id,
          type: "button",
          className: "rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:shadow-md",
          onClick: () => navigate(`/folder/${folder.id}`),
        },
        createElement("span", { className: "block truncate font-semibold" }, folder.title || "Sem título"),
      )),
    ),
  );
}
