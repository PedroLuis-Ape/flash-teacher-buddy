import { describe, expect, it } from "vitest";
import {
  classifyRuntimeHost,
  createSystemHealthSnapshot,
  getSupabaseProjectRef,
  hasPersistedSupabaseSession,
} from "./systemHealth";

describe("systemHealth", () => {
  it("classifica domínio canônico, domínio raiz e previews", () => {
    expect(classifyRuntimeHost("www.apeeducation.org")).toBe("canonical");
    expect(classifyRuntimeHost("apeeducation.org")).toBe("apex");
    expect(classifyRuntimeHost("deploy-preview-77--ape.netlify.app")).toBe("preview");
    expect(classifyRuntimeHost("localhost")).toBe("preview");
    expect(classifyRuntimeHost("example.com")).toBe("other");
  });

  it("extrai somente o project ref público da URL do Supabase", () => {
    expect(getSupabaseProjectRef("https://abc123.supabase.co")).toBe("abc123");
    expect(getSupabaseProjectRef("not-a-url")).toBeNull();
    expect(getSupabaseProjectRef()).toBeNull();
  });

  it("detecta a presença do armazenamento oficial sem ler o conteúdo", () => {
    const storage = {
      getItem(key: string) {
        return key === "sb-abc123-auth-token" ? "stored" : null;
      },
    };

    expect(hasPersistedSupabaseSession(storage, "abc123")).toBe(true);
    expect(hasPersistedSupabaseSession(storage, "other")).toBe(false);
    expect(hasPersistedSupabaseSession(null, "abc123")).toBe(false);
  });

  it("gera snapshot sem expor chave, token ou conteúdo da sessão", () => {
    const snapshot = createSystemHealthSnapshot({
      hostname: "www.apeeducation.org",
      isOnline: true,
      mode: "production",
      supabaseUrl: "https://abc123.supabase.co",
      storage: { getItem: () => "secret-session-value" },
    });

    expect(snapshot).toEqual({
      hostname: "www.apeeducation.org",
      hostKind: "canonical",
      canonicalUrl: "https://www.apeeducation.org",
      isOnline: true,
      mode: "production",
      supabaseConfigured: true,
      supabaseProjectRef: "abc123",
      persistedSessionDetected: true,
    });
    expect(JSON.stringify(snapshot)).not.toContain("secret-session-value");
  });
});
