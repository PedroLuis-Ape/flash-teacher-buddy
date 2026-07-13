import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPublicTeacherStructuredData } from "./publicTeacherStructuredData";

describe("public teacher discovery", () => {
  it("builds a ProfilePage connected to the teacher and public materials", () => {
    const data = buildPublicTeacherStructuredData(
      {
        display_name: "Professora Ana",
        avatar_url: "https://example.com/ana.jpg",
        public_slug: "ana",
        public_bio: "Inglês para iniciantes.",
        public_specialties: ["Conversação"],
      },
      [{
        id: "11111111-1111-4111-8111-111111111111",
        title: "Inglês A1",
        description: "Vocabulário básico.",
      }],
    );

    const graph = data["@graph"] as Array<Record<string, unknown>>;
    expect(graph[0]["@type"]).toBe("ProfilePage");
    expect(graph[1]["@type"]).toBe("Person");
    expect(graph[1].knowsAbout).toEqual(["Conversação"]);
    expect(graph.some((node) => node["@type"] === "ItemList")).toBe(true);
    expect(JSON.stringify(data)).toContain("/portal/folder/11111111-1111-4111-8111-111111111111");
  });

  it("keeps missing profiles out of search indexes and supports the legacy backend", () => {
    const page = readFileSync("src/pages/PublicTeacherProfile.tsx", "utf8");

    expect(page).toContain("search_public_teachers");
    expect(page).toContain("candidate.public_slug.toLocaleLowerCase");
    expect(page.match(/robots="noindex,nofollow"/g)).toHaveLength(2);
    expect(page).toContain("canonicalPath={null}");
    expect(page).toContain("buildPublicTeacherStructuredData(profile, folders)");
  });

  it("integrates dynamic pre-rendering into the production build", () => {
    const packageJson = readFileSync("package.json", "utf8");
    const loader = readFileSync("scripts/public-directory-data.mjs", "utf8");
    const prerender = readFileSync("scripts/prerender-public-teachers.mjs", "utf8");
    const migration = readFileSync("supabase/migrations/20260713022000_public_teacher_discovery_prerender.sql", "utf8");

    expect(packageJson).toContain("prerender-public-teachers.mjs");
    expect(packageJson).toContain("validate-public-teacher-prerender.mjs");
    expect(loader).toContain("PRODUCTION_DATA_PROJECT_ID");
    expect(loader).toContain("repository-fallback");
    expect(prerender).toContain("public-teacher-prerender-report.json");
    expect(prerender).toContain("appendTeacherUrlsToSitemap");
    expect(prerender).toContain("injectTeacherRedirects");
    expect(migration).toContain("list_public_teacher_discovery_entries");
    expect(migration).toContain("LOWER(BTRIM(p.public_slug)) = LOWER(BTRIM(_slug))");
  });
});
