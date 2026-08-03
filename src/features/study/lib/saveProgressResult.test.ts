import { describe, expect, it } from "vitest";
import { awaitSaveProgress, isRemoteConfirmed } from "./saveProgressResult";

describe("saveProgressResult", () => {
  it("propaga uma confirmação remota", async () => {
    const result = await awaitSaveProgress(async () => ({
      status: "remote-confirmed",
      sessionId: "s1",
      updatedAt: 1,
    }));
    expect(isRemoteConfirmed(result)).toBe(true);
  });

  it("degrada para local-only quando o remoto excede o tempo limite", async () => {
    const result = await awaitSaveProgress(
      () => new Promise((resolve) => setTimeout(() => resolve({
        status: "remote-confirmed", sessionId: "s1", updatedAt: 1,
      }), 50)),
      5,
    );
    expect(result).toMatchObject({ status: "local-only", reason: "remote-timeout" });
  });

  it("nunca finge confirmação remota em falha", async () => {
    const result = await awaitSaveProgress(async () => { throw new Error("offline"); });
    expect(result).toEqual({ status: "failed", reason: "offline" });
  });
});
