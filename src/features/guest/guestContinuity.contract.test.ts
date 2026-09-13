import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(`../../../${path}`, import.meta.url), "utf8");
const locales = ["pt-BR", "en", "es", "fr", "it"];

describe("continuidade do visitante (Fase 3)", () => {
  it("a pergunta de merge e montada no shell autenticado e nao bloqueia nada", () => {
    const shell = read("src/components/layout/PrivateShell.tsx");
    const prompt = read("src/features/guest/GuestStateMergePrompt.tsx");
    expect(shell).toContain("<GuestStateMergePrompt />");
    // Fechar sem responder aplica a politica definida: o dispositivo vence.
    expect(prompt).toContain('if (!next) apply("device")');
    expect(prompt).toContain("readGuestMergeDecision(userId)");
  });

  it("o convite de conta so aparece para visitante com progresso local", () => {
    const invite = read("src/features/guest/GuestAccountInvite.tsx");
    const page = read("src/pages/PublicLearningListPage.tsx");
    expect(page).toContain("<GuestAccountInvite />");
    expect(invite).toContain("if (isLoading || userId || dismissed) return null;");
    expect(invite).toContain("if (!hasGuestState()) return null;");
  });

  it("todas as locales tem as chaves do merge", () => {
    for (const locale of locales) {
      const json = JSON.parse(read(`src/i18n/resources/${locale}/home.json`));
      expect(json.guestMerge.title.length).toBeGreaterThan(5);
      expect(json.guestMerge.useDevice.length).toBeGreaterThan(3);
      expect(json.guestMerge.inviteCta.length).toBeGreaterThan(3);
    }
  });
});

