import { describe, expect, it } from "vitest";
import {
  classifyRuntimeHost,
  createSystemHealthSnapshot,
  isSupabasePublicUrlConfigured,
} from "./systemHealth";

describe("systemHealth", () => {
  it("classifica domínio canônico, domínio raiz e previews", () => {
    expect(classifyRuntimeHost("www.apeeducation.org")).toBe("canonical");
    expect(classifyRuntimeHost("apeeducation.org")).toBe("apex");
    expect(classifyRuntimeHost("deploy-preview-77--ape.netlify.app")).toBe("preview");
    expect(classifyRuntimeHost("localhost")).toBe("preview");
    expect(classifyRuntimeHost("example.com")).toBe("other");
  });

  it("valida somente uma URL pública compatível", () => {
    expect(isSupabasePublicUrlConfigured("https://sample.supabase.co")).toBe(true);
    expect(isSupabasePublicUrlConfigured("http://sample.supabase.co")).toBe(false);
    expect(isSupabasePublicUrlConfigured("https://example.com")).toBe(false);
    expect(isSupabasePublicUrlConfigured("invalid")).toBe(false);
    expect(isSupabasePublicUrlConfigured()).toBe(false);
  });

  it("gera snapshot sem incluir valores de configuração", () => {
    const snapshot = createSystemHealthSnapshot({
      hostname: "www.apeeducation.org",
      isOnline: true,
      mode: "production",
      supabaseUrl: "https://sample.supabase.co",
    });

    expect(snapshot).toEqual({
      hostname: "www.apeeducation.org",
      hostKind: "canonical",
      canonicalUrl: "https://www.apeeducation.org",
      isOnline: true,
      mode: "production",
      supabaseConfigured: true,
    });
    expect(JSON.stringify(snapshot)).not.toContain("sample");
  });
});
