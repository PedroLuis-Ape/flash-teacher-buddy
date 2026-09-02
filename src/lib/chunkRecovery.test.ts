import { describe, expect, it } from "vitest";
import {
  CHUNK_RECOVERY_PARAM,
  chunkRetryStorageKey,
  claimChunkRetry,
  createFreshAppShellUrl,
} from "./chunkRecovery";

describe("chunk recovery", () => {
  it("scopes the automatic retry to the deployed build and route", () => {
    const storage = new Map<string, string>();
    const adapter = {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => { storage.set(key, value); },
    };

    expect(claimChunkRetry("build-a", "/list/one/games", adapter)).toBe(true);
    expect(claimChunkRetry("build-a", "/list/one/games", adapter)).toBe(false);
    expect(claimChunkRetry("build-b", "/list/one/games", adapter)).toBe(true);
    expect(storage.has(chunkRetryStorageKey("build-a", "/list/one/games"))).toBe(true);
  });

  it("adds a cache-busting marker without dropping the authenticated route", () => {
    const result = new URL(createFreshAppShellUrl(
      "https://www.apeeducation.org/list/card/games?institution=english#top",
      123,
    ));

    expect(result.pathname).toBe("/list/card/games");
    expect(result.searchParams.get("institution")).toBe("english");
    expect(result.searchParams.get(CHUNK_RECOVERY_PARAM)).toBe("123");
    expect(result.hash).toBe("#top");
  });
});
