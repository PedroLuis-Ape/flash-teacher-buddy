import { describe, expect, it } from "vitest";
import {
  classifyRuntimeHost,
  createSystemHealthSnapshot,
  evaluateBackendContract,
} from "./systemHealth";

const projectId = "abcdefghijklmnopqrst";
const supabaseUrl = `https://${projectId}.supabase.co`;
const publishableKey = "sb_publishable_example";

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
      projectId,
      supabaseUrl,
      publishableKey,
    })).toBe("valid");
  });

  it("detecta qualquer variável pública obrigatória ausente", () => {
    expect(evaluateBackendContract({ projectId, publishableKey })).toBe("missing");
    expect(evaluateBackendContract({ projectId, supabaseUrl })).toBe("missing");
    expect(evaluateBackendContract({ supabaseUrl, publishableKey })).toBe("missing");
  });

  it("detecta configuração divergente, URL inválida e chave inválida", () => {
    expect(evaluateBackendContract({
      projectId,
      supabaseUrl: "https://differentprojectref.supabase.co",
      publishableKey,
    })).toBe("mismatch");

    expect(evaluateBackendContract({
      projectId,
      supabaseUrl: "not-a-url",
      publishableKey,
    })).toBe("invalid-url");

    expect(evaluateBackendContract({
      projectId,
      supabaseUrl,
      publishableKey: "not-a-publishable-key",
    })).toBe("invalid-key");
  });

  it("rejeita protocolo, credencial e caminho inesperados", () => {
    expect(evaluateBackendContract({
      projectId,
      supabaseUrl: `http://${projectId}.supabase.co`,
      publishableKey,
    })).toBe("mismatch");

    expect(evaluateBackendContract({
      projectId,
      supabaseUrl: `https://user:pass@${projectId}.supabase.co`,
      publishableKey,
    })).toBe("mismatch");

    expect(evaluateBackendContract({
      projectId,
      supabaseUrl: `${supabaseUrl}/rest`,
      publishableKey,
    })).toBe("mismatch");
  });

  it("gera snapshot do ambiente atual", () => {
    expect(createSystemHealthSnapshot({
      hostname: "www.apeeducation.org",
      isOnline: true,
      mode: "production",
      backendProjectId: projectId,
      backendUrl: supabaseUrl,
      backendPublishableKey: publishableKey,
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
