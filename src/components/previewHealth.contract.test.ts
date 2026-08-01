import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const healthSource = readFileSync(new URL("./PreviewHealth.tsx", import.meta.url), "utf8");

describe("preview health route contract", () => {
  it("does not depend on Supabase, auth or user data", () => {
    expect(healthSource).not.toMatch(/from\s+["'][^"']*(supabase|auth|query)[^"']*["']/i);
    expect(healthSource).not.toMatch(/\b(useAuth|useSession|useQuery|localStorage|sessionStorage)\s*\(/i);
    expect(healthSource).toContain('data-testid="preview-health"');
    expect(healthSource).toContain('data-health-status="ok"');
  });
});
