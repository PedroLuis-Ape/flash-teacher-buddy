export type PublicTeacherDirectoryErrorKind = "missing-rpc" | "request-failed";

export function classifyPublicTeacherDirectoryError(error: unknown): PublicTeacherDirectoryErrorKind {
  const value = error as { code?: string; message?: string; details?: string } | null;
  const text = `${value?.message ?? ""} ${value?.details ?? ""}`.toLowerCase();

  if (
    value?.code === "PGRST202"
    || value?.code === "42883"
    || text.includes("search_public_teachers")
  ) {
    return "missing-rpc";
  }

  return "request-failed";
}
