import { describe, expect, it } from "vitest";
import {
  classifyRuntimeHost,
  createSystemHealthSnapshot,
  evaluateBackendContract,
} from "./systemHealth";

describe("systemHealth", () => {
  it("classifica domínio canônico, domínio raiz e previews", () => {
    expect(classifyRuntimeHost("www.apeeducation.org")).toBe("canonical");
    expect(classifyRuntimeHost("apeeducation.org")).toBe("apex");
    expect(classifyRuntimeHost("deploy-preview-77--ape.netlify.app")).toBe("preview");
    expect(classifyRuntimeHost("localhost")).toBe("preview");
    expect(classifyRuntimeHost("example.com")).toBe("other");
  });

  it("valida um backend consistente sem expor credenciais", () => {
    expect(evaluateBackendContract({
      projectId: "abcdefghijklmnopqrst",
      supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co",
    })).toBe("valid");
  });

  it("detecta configuração ausente, divergente e URL inválida", () => {
    expect(evaluateBackendContract({ projectId: "abcdefghijklmnopqrst" })).toBe("missing");

    expect(evaluateBackendContract({
      projectId: "abcdefghijklmnopqrst",
      supabaseUrl: "https://differentprojectref.supabase.co",
    })).toBe("mismatch");

    expect(evaluateBackendContract({
      projectId: "abcdefghijklmnopqrst",
      supabaseUrl: "not-a-url",
    })).toBe("invalid-url");
  });

  it("rejeita protocolo, credencial e caminho inesperados", () => {
    expect(evaluateBackendContract({
      projectId: "abcdefghijklmnopqrst",
      supabaseUrl: "http://abcdefghijklmnopqrst.supabase.co",
    })).toBe("mismatch");

    expect(evaluateBackendContract({
      projectId: "abcdefghijklmnopqrst",
      supabaseUrl: "https://user:pass@abcdefghijklmnopqrst.supabase.co",
    })).toBe("mismatch");

    expect(evaluateBackendContract({
      projectId: "abcdefghijklmnopqrst",
      supabaseUrl: "https://abcdefghijklmnopqrst.supabase.co/rest",
    })).toBe("mismatch");
  });

  it("gera snapshot do ambiente atual", () => {
    expect(createSystemHealthSnapshot({
      hostname: "www.apeeducation.org",
      isOnline: true,
      mode: "production",
      backendProjectId: "abcdefghijklmnopqrst",
      backendUrl: "https://abcdefghijklmnopqrst.supabase.co",
    })).toEqual({
      hostname: "www.apeeducation.org",
      hostKind: "canonical",
      canonicalUrl: "https://www.apeeducation.org",
      isOnline: true,
      mode: "production",
      backendContract: "valid",
    });
  });
});
