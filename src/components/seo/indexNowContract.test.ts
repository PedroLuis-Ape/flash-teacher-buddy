import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const key = "ed51acee0d4a4b1398698bade3f8c3e8";

describe("IndexNow publication contract", () => {
  it("hosts the ownership key at the canonical root", () => {
    expect(readFileSync(resolve(root, `public/${key}.txt`), "utf8").trim()).toBe(key);
  });

  it("submits only the published sitemap URLs through the global endpoint", () => {
    const script = readFileSync(resolve(root, "scripts/submit-indexnow.mjs"), "utf8");

    expect(script).toContain('const SITE_URL = "https://www.apeeducation.org"');
    expect(script).toContain("https://api.indexnow.org/indexnow");
    expect(script).toContain("keyLocation: KEY_LOCATION");
    expect(script).toContain("urlList");
    expect(script).toContain("url.host === SITE_HOST");
  });
});
