import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/integrations/supabase/guestSyncClient.ts"), "utf8");

describe("guest sync client runtime", () => {
  it("uses the same resolved runtime as the primary Supabase client", () => {
    expect(source).toContain('import { readPlatformRuntime } from "./platformRuntime"');
    expect(source).toContain("readPlatformRuntime()");
    expect(source).not.toContain("import.meta.env.VITE_SUPABASE_URL");
    expect(source).not.toContain("import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY");
  });
});
