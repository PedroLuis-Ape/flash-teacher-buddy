import type { StudyDeckResourceKind, StudyDeckSource } from "./studyDeckLoader";

export interface StudyResourceContextInput {
  pathname: string;
  id?: string;
  collectionId?: string;
}

export interface StudyResourceContext {
  resourceId: string;
  resourceKind: StudyDeckResourceKind;
  source: StudyDeckSource;
  isPublic: boolean;
}

/**
 * Router params use `:id` for both lists and collections, so the param name is
 * not a safe discriminator. The route namespace is the structural authority.
 */
export function resolveStudyResourceContext(
  input: StudyResourceContextInput,
): StudyResourceContext {
  const pathname = input.pathname || "/";
  const isCollection = /(^|\/)collection\//.test(pathname);
  const isPublic = pathname.startsWith("/portal/");
  const resourceKind: StudyDeckResourceKind = isCollection ? "collection" : "list";
  const source: StudyDeckSource = isPublic
    ? isCollection
      ? "portal-collection-rest"
      : "portal-list-rpc"
    : "private-rest";

  return {
    resourceId: input.collectionId || input.id || "",
    resourceKind,
    source,
    isPublic,
  };
}
