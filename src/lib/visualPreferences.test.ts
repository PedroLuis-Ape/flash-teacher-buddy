import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_VISUAL_PREFERENCES,
  VISUAL_PREFERENCES_STORAGE_KEY,
  applyVisualPreferences,
  migrateLegacyVisualPreferences,
  normalizeVisualPreferences,
  parseVisualPreferences,
  persistVisualPreferences,
  readVisualPreferences,
  resolveAppearance,
  withAppearance,
  withLegacyPaletteSelection,
  withPalette,
  withVisualStyle,
} from "./visualPreferences";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
    clear: vi.fn(() => values.clear()),
  };
}

function createRoot() {
  const attributes = new Map<string, string>();
  const classes = new Set<string>();
  return {
    attributes,
    classes,
    root: {
      setAttribute: vi.fn((name: string, value: string) => attributes.set(name, value)),
      toggleAttribute: vi.fn((name: string, force: boolean) => {
        if (force) attributes.set(name, "");
        else attributes.delete(name);
      }),
      classList: {
        add: vi.fn((...names: string[]) => names.forEach((name) => classes.add(name))),
        remove: vi.fn((...names: string[]) => names.forEach((name) => classes.delete(name))),
      },
      style: {
        colorScheme: "",
        backgroundColor: "",
      },
    },
  };
}

describe("visual preference contract", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
    vi.stubGlobal("window", {
      matchMedia: vi.fn(() => ({ matches: false })),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("migrates every legacy palette without losing its existing base appearance", () => {
    expect(migrateLegacyVisualPreferences("classic", null)).toEqual(
      DEFAULT_VISUAL_PREFERENCES,
    );
    expect(migrateLegacyVisualPreferences("fresh", null)).toMatchObject({
      appearance: "light",
      visualStyle: "classic",
      palette: "green",
    });
    expect(migrateLegacyVisualPreferences("galaxy", "light")).toMatchObject({
      appearance: "dark",
      visualStyle: "galaxy",
      palette: "galaxy",
    });
  });

  it("repairs malformed combinations instead of applying a broken Galaxy hybrid", () => {
    expect(
      normalizeVisualPreferences({
        version: 1,
        appearance: "light",
        visualStyle: "classic",
        palette: "galaxy",
      }),
    ).toEqual({
      version: 1,
      appearance: "dark",
      visualStyle: "galaxy",
      palette: "galaxy",
    });
  });

  it("falls back safely when the versioned value is invalid", () => {
    expect(parseVisualPreferences("{broken")).toBeNull();
    expect(parseVisualPreferences(JSON.stringify({ version: 2 }))).toBeNull();
  });

  it("persists the versioned source of truth and rollback-compatible keys", () => {
    const next = withLegacyPaletteSelection(DEFAULT_VISUAL_PREFERENCES, "white");
    persistVisualPreferences(next);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      VISUAL_PREFERENCES_STORAGE_KEY,
      JSON.stringify(next),
    );
    expect(localStorage.setItem).toHaveBeenCalledWith("ape:palette", "white");
    expect(localStorage.setItem).toHaveBeenCalledWith("theme", "light");
    expect(readVisualPreferences()).toEqual(next);
  });

  it("keeps appearance, palette and visual style as explicit update operations", () => {
    const system = withAppearance(DEFAULT_VISUAL_PREFERENCES, "system");
    const green = withPalette(system, "green");
    const playful = withVisualStyle(green, "playful");

    expect(playful).toEqual({
      version: 1,
      appearance: "system",
      visualStyle: "playful",
      palette: "green",
    });
  });

  it("keeps the legacy palette selector behavior during the migration", () => {
    expect(
      withLegacyPaletteSelection(
        withAppearance(DEFAULT_VISUAL_PREFERENCES, "system"),
        "green",
      ),
    ).toMatchObject({
      appearance: "light",
      visualStyle: "classic",
      palette: "green",
    });
  });

  it("resolves system appearance through the operating-system preference", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn(() => ({ matches: true })),
    });
    expect(resolveAppearance("system")).toBe("light");
  });

  it("applies all root attributes before React depends on them", () => {
    const fake = createRoot();
    vi.stubGlobal("document", { documentElement: fake.root });

    applyVisualPreferences({
      version: 1,
      appearance: "system",
      visualStyle: "playful",
      palette: "green",
    });

    expect(fake.attributes.get("data-visual-preferences-version")).toBe("1");
    expect(fake.attributes.get("data-appearance")).toBe("system");
    expect(fake.attributes.get("data-resolved-appearance")).toBe("dark");
    expect(fake.attributes.get("data-visual-style")).toBe("playful");
    expect(fake.attributes.get("data-palette")).toBe("green");
    expect(fake.classes.has("dark")).toBe(true);
    expect(fake.root.style.colorScheme).toBe("dark");
  });
});
