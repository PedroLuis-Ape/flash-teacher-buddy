import { describe, expect, it, vi } from "vitest";
import {
  classifyStudyDeckVerificationError,
  verifyStudyDeckAvailability,
} from "./studyDeckAvailability";

const source = "private-rest" as const;

describe("verifyStudyDeckAvailability", () => {
  it("accepts loaded rows with playable cards", async () => {
    await expect(verifyStudyDeckAvailability({
      source,
      rawCount: 4,
      playableCount: 3,
    })).resolves.toEqual({ status: "has-cards", rawCount: 4, playableCount: 3, source });
  });

  it("accepts loaded rows when playable count is not calculated yet", async () => {
    await expect(verifyStudyDeckAvailability({
      source,
      rawCount: 4,
    })).resolves.toEqual({ status: "has-cards", rawCount: 4, source });
  });

  it("classifies raw rows that collapse to zero as an invalid deck", async () => {
    await expect(verifyStudyDeckAvailability({
      source,
      rawCount: 2,
      playableCount: 0,
    })).resolves.toMatchObject({ status: "unconfirmed", reason: "invalid-deck" });
  });

  it("never confirms an empty payload without an authority probe", async () => {
    await expect(verifyStudyDeckAvailability({
      source,
      rawCount: 0,
    })).resolves.toMatchObject({ status: "unconfirmed", reason: "verification-unavailable" });
  });

  it("confirms empty only when an accessible resource has an authoritative zero", async () => {
    await expect(verifyStudyDeckAvailability({
      source,
      rawCount: 0,
      probe: async () => ({
        status: "verified",
        resourceExists: true,
        rawCount: 0,
        playableCount: 0,
      }),
    })).resolves.toEqual({ status: "confirmed-empty", rawCount: 0, playableCount: 0, source });
  });

  it("does not confuse an inaccessible resource with an empty resource", async () => {
    await expect(verifyStudyDeckAvailability({
      source,
      rawCount: 0,
      probe: async () => ({ status: "verified", resourceExists: false, rawCount: 0 }),
    })).resolves.toMatchObject({ status: "unconfirmed", reason: "resource-unavailable" });
  });

  it("keeps a missing RPC as unconfirmed", async () => {
    await expect(verifyStudyDeckAvailability({
      source: "portal-list-rpc",
      rawCount: 0,
      probe: async () => ({ status: "unconfirmed", reason: "verification-unavailable" }),
    })).resolves.toMatchObject({ status: "unconfirmed", reason: "verification-unavailable" });
  });

  it("keeps auth and RLS failures as unconfirmed", async () => {
    await expect(verifyStudyDeckAvailability({
      source,
      rawCount: 0,
      probe: async () => ({ status: "unconfirmed", reason: "auth-or-access" }),
    })).resolves.toMatchObject({ status: "unconfirmed", reason: "auth-or-access" });
  });

  it("reports cards when the authority sees rows after an empty payload", async () => {
    await expect(verifyStudyDeckAvailability({
      source,
      rawCount: 0,
      probe: async () => ({ status: "verified", resourceExists: true, rawCount: 8 }),
    })).resolves.toEqual({ status: "has-cards", rawCount: 8, source });
  });

  it("uses the authoritative playable count for public layered cards", async () => {
    await expect(verifyStudyDeckAvailability({
      source: "portal-list-rpc",
      rawCount: 0,
      probe: async () => ({
        status: "verified",
        resourceExists: true,
        rawCount: 8,
        playableCount: 3,
      }),
    })).resolves.toEqual({
      status: "has-cards",
      rawCount: 8,
      playableCount: 3,
      source: "portal-list-rpc",
    });
  });

  it("rejects inconsistent zero raw and positive playable counts", async () => {
    await expect(verifyStudyDeckAvailability({
      source,
      rawCount: 0,
      probe: async () => ({
        status: "verified",
        resourceExists: true,
        rawCount: 0,
        playableCount: 1,
      }),
    })).resolves.toMatchObject({ status: "unconfirmed", reason: "unknown" });
  });

  it("rejects invalid count values", async () => {
    const probe = vi.fn();
    await expect(verifyStudyDeckAvailability({
      source,
      rawCount: Number.NaN,
      probe,
    })).resolves.toMatchObject({ status: "unconfirmed", reason: "unknown" });
    expect(probe).not.toHaveBeenCalled();
  });
});

describe("classifyStudyDeckVerificationError", () => {
  it.each([
    [{ code: "PGRST202" }, "verification-unavailable"],
    [{ code: "42883" }, "verification-unavailable"],
    [{ code: "42501" }, "auth-or-access"],
    [{ status: 401 }, "auth-or-access"],
    [new Error("Failed to fetch"), "network"],
    [new Error("request timeout"), "network"],
    [new Error("unexpected"), "unknown"],
  ] as const)("classifies %o", (error, expected) => {
    expect(classifyStudyDeckVerificationError(error)).toBe(expected);
  });
});
