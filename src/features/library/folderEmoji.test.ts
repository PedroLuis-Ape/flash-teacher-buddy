import { describe, expect, it } from "vitest";
import {
  DEFAULT_FOLDER_EMOJI,
  FOLDER_EMOJI_CHOICES,
  persistLocalEmoji,
  readLocalEmoji,
  resolveFolderEmoji,
} from "./folderEmoji";

function createStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

describe("folder emoji", () => {
  it("prioritizes the cloud emoji over the local emoji", () => {
    expect(resolveFolderEmoji("🎯", "📚")).toBe("🎯");
  });

  it("falls back through local storage and then to the folder default", () => {
    expect(resolveFolderEmoji("  ", "📚")).toBe("📚");
    expect(resolveFolderEmoji("", "  ")).toBe(DEFAULT_FOLDER_EMOJI);
    expect(resolveFolderEmoji(null, null)).toBe("📁");
  });

  it("persists, reads, and removes a folder emoji locally", () => {
    const storage = createStorage();

    persistLocalEmoji(storage, "folder-1", " 📚 ");
    persistLocalEmoji(storage, "folder-2", "🎬");
    expect(readLocalEmoji(storage)).toEqual({ "folder-1": "📚", "folder-2": "🎬" });

    persistLocalEmoji(storage, "folder-1", null);
    expect(readLocalEmoji(storage)).toEqual({ "folder-2": "🎬" });
  });

  it("keeps the curated picker within the requested size", () => {
    const choiceCount = FOLDER_EMOJI_CHOICES.reduce((total, group) => total + group.emojis.length, 0);
    expect(choiceCount).toBeGreaterThanOrEqual(36);
    expect(choiceCount).toBeLessThanOrEqual(48);
  });

  it("keeps the card default when no emoji was chosen", () => {
    expect(resolveFolderEmoji(undefined, undefined)).toBe(DEFAULT_FOLDER_EMOJI);
  });
});
