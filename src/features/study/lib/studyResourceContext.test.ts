import { describe, expect, it } from "vitest";
import { resolveStudyResourceContext } from "./studyResourceContext";

describe("resolveStudyResourceContext", () => {
  it.each([
    ["/list/list-1/study", "list", "private-rest", false],
    ["/list/list-1/mixed-study", "list", "private-rest", false],
    ["/collection/collection-1/study", "collection", "private-rest", false],
    ["/collection/collection-1/mixed-study", "collection", "private-rest", false],
    ["/portal/list/list-1/study", "list", "portal-list-rpc", true],
    ["/portal/list/list-1/mixed-study", "list", "portal-list-rpc", true],
    ["/portal/collection/collection-1/study", "collection", "portal-collection-rest", true],
    ["/portal/collection/collection-1/mixed-study", "collection", "portal-collection-rest", true],
  ] as const)("resolves %s", (pathname, resourceKind, source, isPublic) => {
    expect(resolveStudyResourceContext({ pathname, id: "route-id" })).toEqual({
      resourceId: "route-id",
      resourceKind,
      source,
      isPublic,
    });
  });

  it("accepts the legacy collectionId param without changing collection identity", () => {
    expect(resolveStudyResourceContext({
      pathname: "/portal/collection/collection-1/study",
      collectionId: "legacy-id",
    }).resourceId).toBe("legacy-id");
  });
});
