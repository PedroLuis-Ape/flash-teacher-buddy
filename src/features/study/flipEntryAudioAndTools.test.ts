import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FLIP_ENTRY_AUDIO_DELAY_MS,
  readFlipEntryAudioPreference,
  writeFlipEntryAudioPreference,
} from "./lib/flipEntryAudioPreference";

function installStorage(initial?: Record<string, string>) {
  const values = new Map(Object.entries(initial ?? {}));
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  return values;
}

describe("flip entry audio and responsive tools", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts enabled, persists the choice and waits one second", () => {
    installStorage();
    expect(readFlipEntryAudioPreference()).toBe(true);
    expect(FLIP_ENTRY_AUDIO_DELAY_MS).toBe(1000);

    writeFlipEntryAudioPreference(false);
    expect(readFlipEntryAudioPreference()).toBe(false);

    writeFlipEntryAudioPreference(true);
    expect(readFlipEntryAudioPreference()).toBe(true);
  });

  it("keeps card-change audio separate from the seven-second autoplay", () => {
    const wrapper = readFileSync("src/features/study/components/FlipStudyView.tsx", "utf8");

    expect(wrapper).toContain("readFlipAutoPlayState().enabled");
    expect(wrapper).toContain("window.speechSynthesis?.speaking");
    expect(wrapper).toContain("Áudio ao trocar:");
    expect(wrapper).toContain("FLIP_ENTRY_AUDIO_DELAY_MS");
  });

  it("replaces the mobile toolbox with the existing direct action buttons", () => {
    const css = readFileSync("src/features/study/components/study-tools-menu.css", "utf8");

    expect(css).toContain(".study-tools-portal-slot > div:first-child");
    expect(css).toContain("display: none !important");
    expect(css).toContain(".study-tools-desktop-actions");
    expect(css).toContain("display: flex !important");
    expect(css).toContain("flex-wrap: wrap");
  });
});
