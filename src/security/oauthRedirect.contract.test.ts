import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../pages/OAuthConsent.tsx", import.meta.url), "utf8");

describe("redirect do consentimento OAuth", () => {
  it("so aceita http(s) antes de navegar", () => {
    expect(source).toContain("function safeRedirectUrl(");
    expect(source).toContain('url.protocol === "https:" || url.protocol === "http:"');
  });

  it("usa o filtro nos dois pontos de navegacao", () => {
    expect(source).toContain("const immediate = safeRedirectUrl(");
    expect(source).toContain("const target = safeRedirectUrl(");
    expect(source).not.toContain("window.location.href = data?.redirect");
  });
});
