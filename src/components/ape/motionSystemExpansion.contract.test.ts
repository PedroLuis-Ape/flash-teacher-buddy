import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (file: string) => readFileSync(resolve(process.cwd(), file), "utf8");

describe("shared motion system expansion contract", () => {
  it("provides a reusable button surface without changing button semantics", () => {
    const primitive = read("src/components/ape/MotionButton.tsx");
    const styles = read("src/index.css");

    expect(primitive).toContain('forwardRef<HTMLButtonElement');
    expect(primitive).toContain('type = "button"');
    expect(primitive).toContain("type={type}");
    expect(primitive).toContain("ape-motion-button");
    expect(styles).toContain(".ape-motion-button");
    expect(styles).toContain("prefers-reduced-motion: reduce");
  });

  it("applies shared card, row, progress, and navigation roles to real surfaces", () => {
    const home = read("src/pages/Index.tsx");
    const list = read("src/components/ape/ApeCardList.tsx");
    const folder = read("src/components/ape/ApeCardFolder.tsx");
    const collection = read("src/components/CollectionCard.tsx");
    const studentShortcut = read("src/components/StudentClassShortcut.tsx");
    const turmaShortcut = read("src/components/TurmaShortcut.tsx");
    const tabs = read("src/components/ape/ApeTabBar.tsx");
    const sidebar = read("src/components/layout/AppSidebar.tsx");
    const styles = read("src/index.css");

    expect(home).toContain("ape-interactive-card");
    expect(list).toContain("ape-interactive-card");
    expect(folder).toContain("ape-interactive-card");
    expect(collection).toContain("ape-interactive-card");
    expect(studentShortcut).toContain("ape-motion-row");
    expect(turmaShortcut).toContain("ape-motion-row");
    expect(tabs).toContain("ape-motion-menu-item");
    expect(sidebar).toContain("ape-motion-menu-item");
    expect(styles).toContain(".ape-interactive-card");
    expect(styles).toContain(".ape-motion-row");
    expect(styles).toContain(".ape-motion-menu-item");
  });

  it("keeps feedback and actual progress state motion scoped and reduced-motion safe", () => {
    const feedback = read("src/features/study/components/StudyFeedbackPanel.tsx");
    const completion = read("src/features/study/components/StudyCompletionModal.impl.tsx");
    const progress = read("src/components/ui/progress.tsx");
    const styles = read("src/index.css");

    expect(feedback).toContain("ape-feedback-");
    expect(completion).toContain("ape-feedback-success");
    expect(progress).toContain("ape-motion-progress");
    expect(styles).toContain(".ape-feedback-success");
    expect(styles).toContain(".ape-feedback-error");
    expect(styles).toContain(".ape-motion-progress");
    expect(styles).toContain("data-perf-no-animations");
  });

  it("keeps Radix overlays quick, bounded, and reduced-motion safe", () => {
    const popover = read("src/components/ui/popover.tsx");
    const tooltip = read("src/components/ui/tooltip.tsx");
    const dialog = read("src/components/ui/dialog.tsx");

    for (const source of [popover, tooltip, dialog]) {
      expect(source).toContain("motion-reduce:animate-none");
    }
  });
});
