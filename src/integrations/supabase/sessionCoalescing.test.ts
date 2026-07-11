import { describe, expect, it, vi } from "vitest";
import { installSessionReadCoalescing } from "./sessionCoalescing";

describe("installSessionReadCoalescing", () => {
  it("shares concurrent session reads and caches briefly", async () => {
    let clock = 0;
    const getSession = vi.fn(async () => ({ data: { session: { user: { id: "u1" } } }, error: null }));
    const client = {
      auth: {
        getSession,
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    };

    installSessionReadCoalescing(client, 100, () => clock);
    const [first, second] = await Promise.all([
      client.auth.getSession(),
      client.auth.getSession(),
    ]);
    expect(first).toEqual(second);
    expect(getSession).toHaveBeenCalledTimes(1);

    clock = 50;
    await client.auth.getSession();
    expect(getSession).toHaveBeenCalledTimes(1);

    clock = 101;
    await client.auth.getSession();
    expect(getSession).toHaveBeenCalledTimes(2);
  });
});
