import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser } from "@/hooks/useAuthUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface RecommendedTeacher {
  display_name: string;
  avatar_url: string | null;
  public_slug: string;
  public_bio: string | null;
}

interface Props {
  className?: string;
  privateArea?: boolean;
}

const PRIMARY_TEACHER_SLUG = "pedro";

export function RecommendedTeacherSpotlight({ className, privateArea = false }: Props) {
  const { userId } = useAuthUser();

  const { data: teacher } = useQuery({
    queryKey: ["recommended-teacher", userId || "guest"],
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const [directoryResult, currentProfileResult] = await Promise.all([
        (supabase.rpc as any)("search_public_teachers", { _q: "", _limit: 24 }),
        userId
          ? supabase.from("profiles").select("public_slug").eq("id", userId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ]);

      if (directoryResult.error) throw directoryResult.error;
      if (currentProfileResult.error) throw currentProfileResult.error;

      const ownSlug = currentProfileResult.data?.public_slug?.toLowerCase() || null;
      const teachers = ((directoryResult.data || []) as RecommendedTeacher[])
        .filter((item) => item.public_slug?.toLowerCase() !== ownSlug)
        .sort((a, b) => {
          const aPrimary = a.public_slug?.toLowerCase() === PRIMARY_TEACHER_SLUG ? 0 : 1;
          const bPrimary = b.public_slug?.toLowerCase() === PRIMARY_TEACHER_SLUG ? 0 : 1;
          return aPrimary - bPrimary;
        });

      return teachers[0] || null;
    },
  });

  if (!teacher) return null;

  const initials = teacher.display_name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "PR";

  return (
    <Link
      to={`/portal/professor/${teacher.public_slug}`}
      className={cn(
        "group flex min-w-0 items-center gap-2.5 rounded-xl border border-primary/30 bg-card/80 p-2.5 text-left shadow-sm backdrop-blur transition hover:border-primary/60 hover:bg-card sm:gap-3 sm:rounded-2xl sm:p-3",
        privateArea ? "w-full" : "mt-3 sm:mt-4 sm:max-w-xl",
        className,
      )}
      aria-label={`Ver perfil de ${teacher.display_name}`}
    >
      <Avatar className="h-10 w-10 shrink-0 ring-2 ring-primary/20 sm:h-11 sm:w-11">
        <AvatarImage src={teacher.avatar_url ?? undefined} alt={teacher.display_name} />
        <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">{initials}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-primary sm:text-[11px]">
          Professor recomendado
        </p>
        <p className="truncate text-sm font-bold">{teacher.display_name}</p>
        <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
          {teacher.public_bio || "Inglês para brasileiros · materiais e aulas"}
        </p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold text-primary sm:text-xs">
        Perfil <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
