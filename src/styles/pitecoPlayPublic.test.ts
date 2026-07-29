import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const publicCss = read("src/styles/piteco-play-public.css");
const publicShell = read("src/components/layout/PublicShell.tsx");
const editorialPage = read("src/components/seo/EditorialPage.tsx");
const authPage = read("src/pages/AuthRedesign.tsx");
const qaHtml = read("tools/visual-qa/public-experience.html");

describe("Piteco Play public experience contract", () => {
  it("switches only the shell class while keeping the legacy boundary intact", () => {
    expect(publicShell).toContain('visualStyle === "playful"');
    expect(publicShell).toContain('"ape-public-shell"');
    expect(publicShell).toContain('"space-ui space-ui-shell"');
    expect(publicShell).toContain('"ape-public-main"');
    expect(publicShell).toContain('"space-ui-main"');
    expect(publicShell).toContain('data-ape-public-style=');
    expect(publicShell).toContain(
      'playful && location.pathname.startsWith("/auth")',
    );
  });

  it("keeps public composition doubly scoped and free from specificity patches", () => {
    expect(publicCss).toContain(
      'html[data-visual-style="playful"] .ape-public-shell',
    );
    expect(publicCss).toContain(
      'html[data-visual-style="playful"] .ape-editorial-page',
    );
    expect(publicCss).toContain(
      'html[data-visual-style="playful"] .ape-auth-page',
    );
    expect(publicCss).not.toMatch(/(^|\n)\.ape-/);
    expect(publicCss).not.toContain("!important");
    expect(publicCss).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("preserves the editorial SEO and semantic source of truth", () => {
    expect(editorialPage).toContain("<SEOHead");
    expect(editorialPage).toContain("canonicalPath={page.path}");
    expect(editorialPage).toContain("jsonLd={structuredData}");
    expect(editorialPage).toContain("<h1");
    expect(editorialPage).toContain("<h2");
    expect(editorialPage).toContain("<main>");
    expect(editorialPage).not.toContain("hidden seo");
  });

  it("changes only the presentation shell around authentication", () => {
    expect(authPage).toContain("ape-auth-page");
    expect(authPage).toContain("ape-auth-card");
    expect(authPage).toContain("supabase.auth.getSession()");
    expect(authPage).toContain("supabase.auth.onAuthStateChange");
    expect(authPage).toContain('const canAutoRedirect = mode !== "signup"');
    expect(authPage).toContain("onSuccess={handleSuccess}");
  });

  it("keeps the local style activator outside production entry points", () => {
    expect(qaHtml).toContain('name="robots" content="noindex,nofollow"');
    expect(qaHtml).toContain("/src/visual-qa/public-experience.ts");
    expect(publicShell).not.toContain("public-experience.html");
    expect(editorialPage).not.toContain("public-experience.html");
  });
});
