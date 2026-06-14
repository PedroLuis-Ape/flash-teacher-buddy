import { describe, it, expect } from "vitest";
import { resolveStudyAccess } from "../resolveStudyAccess";

describe("resolveStudyAccess", () => {
  it("returns wait while auth is initializing", () => {
    expect(
      resolveStudyAccess({ authStatus: "initializing", isPortalRoute: false, userId: undefined }),
    ).toBe("wait");
    expect(
      resolveStudyAccess({ authStatus: "initializing", isPortalRoute: true, userId: "u1" }),
    ).toBe("wait");
  });

  it("returns authenticated only when authStatus is authenticated AND userId is present", () => {
    expect(
      resolveStudyAccess({ authStatus: "authenticated", isPortalRoute: false, userId: "u1" }),
    ).toBe("authenticated");
  });

  it("returns wait if authStatus is authenticated but userId is missing (race window)", () => {
    expect(
      resolveStudyAccess({ authStatus: "authenticated", isPortalRoute: false, userId: undefined }),
    ).toBe("wait");
    expect(
      resolveStudyAccess({ authStatus: "authenticated", isPortalRoute: false, userId: null }),
    ).toBe("wait");
  });

  it("routes anonymous users to public on portal routes and denied elsewhere", () => {
    expect(
      resolveStudyAccess({ authStatus: "anonymous", isPortalRoute: true, userId: undefined }),
    ).toBe("public");
    expect(
      resolveStudyAccess({ authStatus: "anonymous", isPortalRoute: false, userId: undefined }),
    ).toBe("denied");
  });

  it("treats auth error like anonymous (portal-only fallback)", () => {
    expect(
      resolveStudyAccess({ authStatus: "error", isPortalRoute: true, userId: undefined }),
    ).toBe("public");
    expect(
      resolveStudyAccess({ authStatus: "error", isPortalRoute: false, userId: undefined }),
    ).toBe("denied");
  });
});