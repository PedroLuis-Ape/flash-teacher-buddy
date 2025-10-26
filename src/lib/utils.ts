import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * @deprecated Use buildPath from safeNavigation.ts instead
 */
export const isPortalPath = (pathname: string) => pathname.startsWith("/portal");

/**
 * @deprecated Use buildPath from safeNavigation.ts instead
 */
export const buildBasePath = (
  pathname: string,
  kind: "list" | "collection" | "folder",
  id: string
) => (isPortalPath(pathname) ? `/portal/${kind}/${id}` : `/${kind}/${id}`);
