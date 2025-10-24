import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const isPortalPath = (pathname: string) => pathname.startsWith("/portal");

export const buildBasePath = (
  pathname: string,
  kind: "list" | "collection" | "folder",
  id: string
) => (isPortalPath(pathname) ? `/portal/${kind}/${id}` : `/${kind}/${id}`);
