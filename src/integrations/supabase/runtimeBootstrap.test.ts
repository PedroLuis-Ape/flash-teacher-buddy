import { describe, expect, it, vi } from "vitest";
import {
  OFFICIAL_RUNTIME_ENDPOINT,
  OFFICIAL_SUPABASE_PROJECT_ID,
  loadOfficialPlatformRuntime,
  validateOfficialRuntime,
} from "./runtimeBootstrap";

const officialPayload = {
  projectId: OFFICIAL_SUPABASE_PROJECT_ID,
  url: `https://${OFFICIAL_SUPABASE_PROJECT_ID}.supabase.co`,
  publishableKey: "test-public-value",
};

describe("Supabase runtime bootstrap", () => {
  it("accepts the official runtime payload", () => {
    expect(validateOfficialRuntime(officialPayload)).toEqual({
      projectId: OFFICIAL_SUPABASE_PROJECT_ID,
      url: `https://${OFFICIAL_SUPABASE_PROJECT_ID}.supabase.co`,
      publicValue: "test-public-value",
    });
    expect(OFFICIAL_RUNTIME_ENDPOINT).toBe(
      `https://${OFFICIAL_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/app-public-config`,
    );
  });

  it("rejects a different project", () => {
    expect(() => validateOfficialRuntime({
      projectId: "abcdefghijklmnopqrst",
      url: "https://abcdefghijklmnopqrst.supabase.co",
      publishableKey: "wrong-project-value",
    })).toThrow("projeto Supabase oficial");
  });

  it("loads the official public configuration endpoint when env is absent", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(officialPayload), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    await expect(loadOfficialPlatformRuntime(fetchMock as typeof fetch)).resolves.toEqual({
      projectId: OFFICIAL_SUPABASE_PROJECT_ID,
      url: `https://${OFFICIAL_SUPABASE_PROJECT_ID}.supabase.co`,
      publicValue: "test-public-value",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      OFFICIAL_RUNTIME_ENDPOINT,
      expect.objectContaining({ cache: "no-store" }),
    );
  });

  it("fails instead of silently switching projects", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      projectId: "abcdefghijklmnopqrst",
      url: "https://abcdefghijklmnopqrst.supabase.co",
      publishableKey: "wrong-project-value",
    }), { status: 200 }));

    await expect(loadOfficialPlatformRuntime(fetchMock as typeof fetch)).rejects.toThrow("projeto Supabase oficial");
  });
});
