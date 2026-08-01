import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("study flow mode coverage", () => {
  it("offers the shared selector in every maintained game entry surface", () => {
    for (const path of [
      "src/pages/GamesHub.tsx",
      "src/pages/PublicClassGamesHub.tsx",
      "src/pages/PublicCollection.tsx",
    ]) {
      expect(read(path)).toContain("StudyFlowModeSelector");
    }
  });

  it("keeps public folder launches inside public game routes", () => {
    const folder = read("src/pages/Folder.tsx");
    expect(folder).toContain('window.location.pathname.startsWith("/portal/folder/")');
    expect(folder).toContain("`/portal/list/${list.id}/games`");
  });

  it("routes mixed continuous sessions through the common study engine", () => {
    const launch = read("src/features/study/lib/studyLaunchParams.ts");
    expect(launch).toContain('mode === "mixed" && flowMode === "mastery_rounds"');
    expect(launch).toContain('? "mixed-study"');
    expect(launch).toContain(': "study"');
  });

  it("supports mastery rounds in Flip without allowing unclassified arrow navigation", () => {
    const settings = read("src/features/study/components/GameSettingsModal.impl.tsx");
    const study = read("src/pages/Study.tsx");
    const flip = read("src/features/study/components/FlipStudyView.impl.tsx");
    expect(settings).toContain("const supportsFlowModes = Boolean(urlMode)");
    expect(study).toContain("onNext={masteryProgressActive ? undefined : navigateNext}");
    expect(study).toContain("onPrevious={masteryProgressActive ? undefined : navigatePrevious}");
    expect(flip).toContain('pureFlipSession && flowMode !== "mastery_rounds"');
    expect(flip).toContain("if (usesManualFlipAnswer)");
  });

  it("passes the active flow to Write instead of forcing mastery copy", () => {
    const write = read("src/features/study/components/WriteStudyView.impl.tsx");
    expect(write).toContain("flowMode?: StudyFlowMode");
    expect(write).toContain("flowMode,");
    expect(write).not.toContain('flowMode: "mastery_rounds"');
  });

  it("keeps in-session format changes synchronized with the URL contract", () => {
    const settings = read("src/features/study/components/GameSettingsModal.impl.tsx");
    expect(settings).toContain('params.set("flow", next)');
    expect(settings).toContain('params.delete("studyFlowMode")');
    expect(settings).toContain("navigate({ pathname: location.pathname, search: params.toString() }, { replace: true })");
  });

  it("initializes pronunciation evaluation before handlers and effects consume it", () => {
    const pronunciation = read("src/features/study/components/PronunciationStudyView.impl.tsx");
    expect(pronunciation.indexOf("const evaluation = useMemo")).toBeGreaterThan(-1);
    expect(pronunciation.indexOf("const evaluation = useMemo")).toBeLessThan(
      pronunciation.indexOf("const handleNext = () =>"),
    );
  });

  it("keeps nested mixed slots on the same skip and flow contracts", () => {
    const flip = read("src/features/study/components/FlipStudyView.tsx");
    const mixedSlot = read("src/features/study/components/MixedSlotActivity.tsx");
    const study = read("src/pages/Study.tsx");
    expect(flip).toContain("onSkip={props.onSkip}");
    expect(flip).toContain("flowMode={props.flowMode}");
    expect(mixedSlot).toContain("flowMode={props.flowMode}");
    expect(study).toContain("onSkip={requestSkip}");
    expect(study).toContain("flowMode={activeStudyFlowMode}");
  });
});
