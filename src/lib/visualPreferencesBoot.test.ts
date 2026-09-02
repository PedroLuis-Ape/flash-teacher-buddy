import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("first-paint visual preference boot", () => {
  const html = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

  it("reads the versioned contract before the application entrypoint", () => {
    const preferenceBoot = html.indexOf("ape:visual-preferences:v1");
    const appEntrypoint = html.indexOf('src="/src/main.tsx"');

    expect(preferenceBoot).toBeGreaterThan(-1);
    expect(appEntrypoint).toBeGreaterThan(preferenceBoot);
  });

  it.each([
    "data-appearance",
    "data-resolved-appearance",
    "data-visual-style",
    "data-palette",
  ])("applies %s during the inline first-paint boot", (attribute) => {
    expect(html).toContain(`setAttribute('${attribute}'`);
  });

  it("keeps legacy keys as a rollback contract", () => {
    expect(html).toContain("localStorage.setItem('ape:palette', palette)");
    expect(html).toContain("localStorage.setItem('theme', resolvedAppearance)");
  });
});
