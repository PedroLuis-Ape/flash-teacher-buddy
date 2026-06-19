import type { ReactNode } from "react";
import { useLibraryChangeRevision } from "@/hooks/useLibraryChangeRevision";

export function LibraryLiveReload({ children }: { children: ReactNode }) {
  const revision = useLibraryChangeRevision();
  return <div key={revision}>{children}</div>;
}
