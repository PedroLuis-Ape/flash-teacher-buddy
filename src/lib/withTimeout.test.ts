import { describe, expect, it } from "vitest";
import { OperationTimeoutError, withTimeout } from "./withTimeout";

describe("withTimeout", () => {
  it("returns the operation result before the deadline", async () => {
    await expect(withTimeout(Promise.resolve("ok"), 100, "test")).resolves.toBe("ok");
  });

  it("rejects a stalled operation with a typed timeout", async () => {
    await expect(withTimeout(new Promise<never>(() => undefined), 5, "Auth hydration"))
      .rejects.toBeInstanceOf(OperationTimeoutError);
  });
});
