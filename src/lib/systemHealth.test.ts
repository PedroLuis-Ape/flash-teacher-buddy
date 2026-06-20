import { describe, expect, it } from "vitest";
import { classifyRuntimeHost, createSystemHealthSnapshot } from "./systemHealth";

describe("systemHealth", () => {
  it("classifica domínio canônico, domínio raiz e previews", () => {
    expect(classifyRuntimeHost("www.apeeducation.org")).toBe("canonical");
    expect(classifyRuntimeHost("apeeducation.org")).toBe("apex");
    expect(classifyRuntimeHost("deploy-preview-77--ape.netlify.app")).toBe("preview");
    expect(classifyRuntimeHost("localhost")).toBe("preview");
    expect(classifyRuntimeHost("example.com")).toBe("other");
  });

  it("gera snapshot do ambiente atual", () => {
    expect(createSystemHealthSnapshot({
      hostname: "www.apeeducation.org",
      isOnline: true,
      mode: "production",
    })).toEqual({
      hostname: "www.apeeducation.org",
      hostKind: "canonical",
      canonicalUrl: "https://www.apeeducation.org",
      isOnline: true,
      mode: "production",
    });
  });
});
