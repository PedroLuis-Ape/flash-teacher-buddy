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

  it("starts enabled, persists the choice and never waits artificially", () => {
    installStorage();
    expect(readFlipEntryAudioPreference()).toBe(true);
    // Contrato V3: nenhum delay artificial antes do áudio de entrada.
    expect(FLIP_ENTRY_AUDIO_DELAY_MS).toBe(0);

    writeFlipEntryAudioPreference(false);
    expect(readFlipEntryAudioPreference()).toBe(false);

    writeFlipEntryAudioPreference(true);
    expect(readFlipEntryAudioPreference()).toBe(true);
  });

  it("triggers card-change audio through the TTS contract, never through a DOM click", () => {
    const wrapper = readFileSync("src/features/study/components/FlipStudyView.tsx", "utf8");
    const impl = readFileSync("src/features/study/components/FlipStudyView.impl.tsx", "utf8");

    expect(wrapper).toContain("Áudio ao trocar:");
    expect(wrapper).toContain("autoSpeakOnCardChange={autoSpeakOnCardChange");
    // Nenhum clique simulado em botão de áudio e nenhuma espera fixa.
    expect(wrapper).not.toContain("audioButton?.click()");
    expect(wrapper).not.toContain("FLIP_ENTRY_AUDIO_DELAY_MS");
    expect(impl).toContain("speakSide(isAFirst ? \"a\" : \"b\")");
  });

  it("keeps a single swipe owner: the deck navigates, the card only suppresses the tap", () => {
    const wrapper = readFileSync("src/features/study/components/FlipStudyView.tsx", "utf8");
    const impl = readFileSync("src/features/study/components/FlipStudyView.impl.tsx", "utf8");
    const touchHandler = impl.slice(impl.indexOf("const onCardTouchEnd"), impl.indexOf("const onCardTouchEnd") + 900);

    expect(wrapper).toContain("swipeNavigation={{");
    expect(touchHandler).not.toContain("onNext()");
    expect(touchHandler).not.toContain("onPrevious()");
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
