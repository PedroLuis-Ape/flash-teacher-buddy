import { describe, expect, it } from "vitest";
import {
  buildWriteCorrectionModeStorageKey,
  WRITE_CORRECTION_MODE_STORAGE_KEY,
} from "./writeCorrectionMode";

describe("writeCorrectionMode", () => {
  it("keeps Write and Mixed correction presets in independent keys", () => {
    expect(buildWriteCorrectionModeStorageKey("write"))
      .toBe(`${WRITE_CORRECTION_MODE_STORAGE_KEY}:write`);
    expect(buildWriteCorrectionModeStorageKey("mixed"))
      .toBe(`${WRITE_CORRECTION_MODE_STORAGE_KEY}:mixed`);
    expect(buildWriteCorrectionModeStorageKey("write"))
      .not.toBe(buildWriteCorrectionModeStorageKey("mixed"));
  });
});
