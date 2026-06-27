import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src", "main.tsx"), "utf8");

describe("preview bootstrap fallback", () => {
  it("uses the remote runtime configuration after rejecting injected values", () => {
    const injectedBlock = source.indexOf("if (envProjectId && envUrl && envPublicValue)");
    const warning = source.indexOf("Ignoring incompatible injected");
    const remoteLoad = source.indexOf("await fetchRuntimeConfig()");

    expect(injectedBlock).toBeGreaterThanOrEqual(0);
    expect(warning).toBeGreaterThan(injectedBlock);
    expect(remoteLoad).toBeGreaterThan(warning);
  });

  it("checks preview context before recovery cleanup", () => {
    const recovery = source.indexOf("async function attemptAutomaticRecovery");
    const previewGuard = source.indexOf("if (isPreviewContext())", recovery);
    const cleanup = source.indexOf("getRegistrations()", recovery);

    expect(recovery).toBeGreaterThanOrEqual(0);
    expect(previewGuard).toBeGreaterThan(recovery);
    expect(cleanup).toBeGreaterThan(previewGuard);
  });
});
