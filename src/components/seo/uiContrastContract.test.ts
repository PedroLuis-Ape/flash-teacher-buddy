import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("public UI contrast contract", () => {
  it("keeps active navigation labels on the high-contrast foreground token", () => {
    const tabs = read("src/components/ape/ApeTabBar.tsx");

    expect(tabs).toContain('active ? "space-ui-tab-active text-foreground"');
    expect(tabs).not.toContain('active ? "space-ui-tab-active text-primary"');
  });

  it("does not dim legal links or version labels below readable contrast", () => {
    const footer = read("src/components/layout/GlobalFooter.tsx");
    const privateShell = read("src/components/layout/PrivateShell.tsx");
    const publicShell = read("src/components/layout/PublicShell.tsx");

    expect(footer).not.toContain("text-primary/50");
    expect(footer).not.toContain("text-muted-foreground/60");
    expect(privateShell).not.toContain("opacity-70 text-[10px]");
    expect(publicShell).not.toContain("opacity-70 text-[10px]");
  });
});
