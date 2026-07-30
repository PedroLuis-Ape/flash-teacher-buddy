import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const authSource = readFileSync(new URL("./AuthContext.tsx", import.meta.url), "utf8");

describe("AuthContext hydration contract", () => {
  it("does not mark INITIAL_SESSION as authenticated before getSession confirms it", () => {
    const initialSessionBranch = authSource.indexOf('if (event === "INITIAL_SESSION")');
    const nextSessionBranch = authSource.indexOf("if (nextSession)", initialSessionBranch);
    const initializingTransition = authSource.indexOf('setStatus("initializing")', initialSessionBranch);
    const getSessionCall = authSource.indexOf(".getSession()");

    expect(initialSessionBranch).toBeGreaterThan(-1);
    expect(initializingTransition).toBeGreaterThan(initialSessionBranch);
    expect(nextSessionBranch).toBeGreaterThan(initialSessionBranch);
    expect(getSessionCall).toBeGreaterThan(nextSessionBranch);
    expect(authSource).toContain("RLS reads");
  });
});
