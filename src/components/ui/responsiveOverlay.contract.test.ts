import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), "utf8");

describe("responsive overlay visual contracts", () => {
  it("keeps dialogs and sheets bounded, scrollable, and safe-area aware", () => {
    const dialog = read("dialog.tsx");
    const alertDialog = read("alert-dialog.tsx");
    const sheet = read("sheet.tsx");

    expect(dialog).toContain("max-h-[min(90dvh,calc(100svh-1rem))]");
    expect(dialog).toContain("ape-overlay-scroll");
    expect(dialog).toContain("env(safe-area-inset-bottom");
    expect(alertDialog).toContain("max-h-[min(90dvh,calc(100svh-1rem))]");
    expect(alertDialog).toContain("env(safe-area-inset-bottom");
    expect(sheet).toContain("min-h-0");
    expect(sheet).toContain("max-h-[min(92dvh,100svh)]");
    expect(sheet).toContain("min-h-11 min-w-11");
  });

  it("keeps portal menus within mobile viewport and touch-friendly", () => {
    const popover = read("popover.tsx");
    const dropdown = read("dropdown-menu.tsx");
    const select = read("select.tsx");

    expect(popover).toContain("max-w-[calc(100vw-1rem)]");
    expect(popover).toContain("collisionPadding={8}");
    expect(dropdown).toContain("max-w-[calc(100vw-1rem)]");
    expect(dropdown).toMatch(/min-h-11[\s\S]*touch-manipulation/);
    expect(select).toMatch(/min-h-11[\s\S]*touch-manipulation/);
    expect(select).toContain("max-h-[min(80dvh,24rem)]");
  });
});
