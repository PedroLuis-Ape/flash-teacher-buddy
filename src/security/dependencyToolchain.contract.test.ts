import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  devDependencies?: Record<string, string>;
  overrides?: Record<string, unknown>;
}

interface PackageLock {
  packages?: Record<string, { version?: string }>;
}

const manifest = JSON.parse(readFileSync("package.json", "utf8")) as PackageManifest;
const lockfile = JSON.parse(readFileSync("package-lock.json", "utf8")) as PackageLock;

describe("dependency security toolchain", () => {
  it("pins the patched Vitest release", () => {
    expect(manifest.devDependencies?.vitest).toBe("4.1.9");
  });

  it("isolates Vitest on the safe Vite 8 toolchain", () => {
    const vitestOverride = manifest.overrides?.vitest as Record<string, string> | undefined;
    expect(vitestOverride?.vite).toBe("8.1.0");
    expect(lockfile.packages?.["node_modules/vitest/node_modules/vite"]?.version).toBe("8.1.0");
  });

  it("does not restore the vulnerable nested esbuild copy", () => {
    expect(lockfile.packages?.["node_modules/vitest/node_modules/esbuild"]).toBeUndefined();
  });
});
