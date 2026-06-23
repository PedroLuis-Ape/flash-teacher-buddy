import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const signup = readFileSync(
  new URL("./components/SignupForm.tsx", import.meta.url),
  "utf8",
);
const callback = readFileSync(
  new URL("../../pages/AuthCallback.tsx", import.meta.url),
  "utf8",
);
const authPage = readFileSync(
  new URL("../../pages/AuthRedesign.tsx", import.meta.url),
  "utf8",
);
const googleLinking = readFileSync(
  new URL("../../hooks/useGoogleLinking.ts", import.meta.url),
  "utf8",
);
const triggerMigration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260623203000_public_signup_profile_trigger.sql",
    import.meta.url,
  ),
  "utf8",
);
const permissionMigration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260623203100_public_signup_permissions.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("public signup onboarding", () => {
  it("keeps profile and role creation out of the browser", () => {
    expect(signup).not.toContain('.from("user_roles").insert');
    expect(signup).not.toContain('supabase.rpc("update_own_profile"');
    expect(signup).toContain("requested_account_type");
    expect(signup).toContain("requested_public_slug");
    expect(signup).toContain("/auth/callback?flow=signup");
  });

  it("waits for signup completion before redirecting", () => {
    expect(authPage).toContain('const canAutoRedirect = mode !== "signup"');
    expect(authPage).toContain("onSuccess={handleSuccess}");
  });

  it("routes users from the persisted profile after confirmation", () => {
    expect(callback).toContain('select("first_name, is_teacher, public_slug")');
    expect(callback).toContain("profile.is_teacher");
    expect(callback).toContain('"/painel-professor"');
    expect(callback).toContain('"/settings/public-profile"');
  });

  it("separates Google identity linking from regular login", () => {
    expect(googleLinking).toContain("/auth/callback?flow=link-google");
    expect(callback).toContain('flow === "link-google"');
  });

  it("replaces every legacy signup trigger with one canonical trigger", () => {
    expect(triggerMigration).toContain("DROP TRIGGER IF EXISTS on_auth_user_created_assign_role");
    expect(triggerMigration).toContain("DROP TRIGGER IF EXISTS on_auth_user_created_profile");
    expect(triggerMigration).toContain("DROP TRIGGER IF EXISTS on_auth_user_created_role");
    expect(triggerMigration.match(/CREATE TRIGGER on_auth_user_created/g)).toHaveLength(1);
  });

  it("creates one persisted role per user", () => {
    expect(triggerMigration).toContain("INSERT INTO public.user_roles");
    expect(triggerMigration).toContain("ON CONFLICT (user_id) DO UPDATE");
    expect(triggerMigration).toContain("requested_account_type");
  });

  it("exposes only a boolean slug check and blocks browser role writes", () => {
    expect(permissionMigration).toContain("is_public_slug_available_v1");
    expect(permissionMigration).toContain("GRANT EXECUTE");
    expect(permissionMigration).toContain("REVOKE INSERT, UPDATE, DELETE ON TABLE public.user_roles");
  });
});
