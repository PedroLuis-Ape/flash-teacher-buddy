import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PRESET_LIGHT,
  readPerformanceSettings,
} from "./performanceSettings";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
    clear: vi.fn(() => values.clear()),
    key: vi.fn((index: number) => Array.from(values.keys())[index] ?? null),
    get length() {
      return values.size;
    },
  };
}

beforeEach(() => {
  vi.stubGlobal("window", {
    matchMedia: vi.fn(() => ({ matches: false })),
  });
});

describe("performance settings glossary safety", () => {
  it("keeps the glossary enabled in the light preset", () => {
    expect(PRESET_LIGHT.wordTooltips).toBe(true);
  });

  it("migrates the historical light preset that silently hid all glossary words", () => {
    const storage = createStorage({
      "ape-performance-settings": JSON.stringify({
        ...PRESET_LIGHT,
        wordTooltips: false,
      }),
    });
    vi.stubGlobal("localStorage", storage);

    const settings = readPerformanceSettings();

    expect(settings.wordTooltips).toBe(true);
    expect(storage.setItem).toHaveBeenCalledWith("ape-performance-settings-version", "2");
  });

  it("preserves an explicit non-light custom choice", () => {
    const storage = createStorage({
      "ape-performance-settings": JSON.stringify({
        preset: "high",
        wordTooltips: false,
      }),
    });
    vi.stubGlobal("localStorage", storage);

    expect(readPerformanceSettings().wordTooltips).toBe(false);
  });
});
