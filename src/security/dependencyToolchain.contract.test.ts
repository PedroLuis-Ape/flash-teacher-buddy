import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  dependencies?: Record<string, string>;
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

  it("pins patched transitive packages reported by the security scan", () => {
    expect(manifest.overrides?.["@hono/node-server"]).toBe("2.0.12");
    expect(manifest.overrides?.["@modelcontextprotocol/sdk"]).toBe("1.30.0");
    expect(manifest.overrides?.["brace-expansion"]).toBe("5.0.8");
    expect(manifest.overrides?.minimatch).toBe("10.2.6");

    expect(lockfile.packages?.["node_modules/@hono/node-server"]?.version).toBe("2.0.12");
    expect(lockfile.packages?.["node_modules/@modelcontextprotocol/sdk"]?.version).toBe("1.30.0");
    expect(lockfile.packages?.["node_modules/brace-expansion"]?.version).toBe("5.0.8");
    expect(lockfile.packages?.["node_modules/minimatch"]?.version).toBe("10.2.6");
  });

  it("keeps the direct build and router decisions explicit", () => {
    expect(manifest.devDependencies?.postcss).toBe("^8.5.25");
    expect(lockfile.packages?.["node_modules/postcss"]?.version).toBe("8.5.25");

    // React Router 7.18.2 is not a safe automatic upgrade while its current
    // high-severity advisory remains unresolved.
    expect(manifest.dependencies?.["react-router-dom"]).toBe("6.30.4");
  });
});
