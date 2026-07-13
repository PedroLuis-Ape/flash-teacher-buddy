import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildPublicLearningResourceStructuredData } from "./publicLearningResourceStructuredData";

describe("public learning-resource discovery", () => {
  it("connects the collection, teacher and published lists", () => {
    const data = buildPublicLearningResourceStructuredData(
      {
        id: "11111111-1111-4111-8111-111111111111",
        title: "Inglês A1",
        description: "Vocabulário essencial.",
        study_type: "language",
        lang_a: "en",
        lang_b: "pt",
        created_at: "2026-06-01T12:00:00.000Z",
        updated_at: "2026-07-13T12:00:00.000Z",
        author_display_name: "Professora Ana",
        author_slug: "ana",
        author_avatar_url: "https://example.com/ana.jpg",
      },
      [{
        id: "22222222-2222-4222-8222-222222222222",
        title: "Verbos básicos",
        description: "Prática de verbos.",
        card_count: 30,
      }],
    );

    const graph = data["@graph"] as Array<Record<string, unknown>>;
    expect(graph[0]["@type"]).toBe("CollectionPage");
    expect(graph[1]["@type"]).toBe("LearningResource");
    expect(graph[1].inLanguage).toEqual(["en", "pt"]);
    expect(graph[2]["@type"]).toBe("Person");
    expect(JSON.stringify(data)).toContain("/portal/professor/ana");
    expect(JSON.stringify(data)).toContain("/portal/list/22222222-2222-4222-8222-222222222222/games");
  });

  it("uses canonical metadata during client-side public-folder navigation", () => {
    const route = readFileSync("src/pages/PublicFolderRoute.tsx", "utf8");
    const app = readFileSync("src/App.tsx", "utf8");

    expect(route).toContain("get_public_learning_resource");
    expect(route).toContain("get_public_learning_resource_lists");
    expect(route).toContain("get_portal_folder");
    expect(route).toContain("buildPublicLearningResourceStructuredData(resource, lists)");
    expect(route).toContain('robots="noindex,nofollow"');
    expect(route).toContain("canonicalPath={null}");
    expect(app).toContain('path="/portal/folder/:id" element={<PublicFolderRoute />}');
  });

  it("requires each anonymous list and card to remain explicitly public", () => {
    const migration = readFileSync(
      "supabase/migrations/20260713134000_public_learning_resource_discovery.sql",
      "utf8",
    );

    expect(migration).toContain("list_public_learning_resource_entries");
    expect(migration).toContain("get_public_learning_resource_lists");
    expect(migration.match(/l\.visibility = 'class'/g)?.length).toBeGreaterThanOrEqual(6);
    expect(migration.match(/l\.class_id IS NULL/g)?.length).toBeGreaterThanOrEqual(6);
    expect(migration).toContain("fc.user_id = f.owner_id");
    expect(migration).toContain("REVOKE ALL ON FUNCTION");
    expect(migration).toContain("GRANT EXECUTE");
  });

  it("integrates static resource generation and validation into production builds", () => {
    const packageJson = readFileSync("package.json", "utf8");
    const loader = readFileSync("scripts/public-learning-resource-data.mjs", "utf8");
    const prerender = readFileSync("scripts/prerender-public-learning-resources.mjs", "utf8");

    expect(packageJson).toContain("prerender-public-learning-resources.mjs");
    expect(packageJson).toContain("validate-public-learning-resource-prerender.mjs");
    expect(loader).toContain("teacher-directory-fallback");
    expect(loader).toContain("list_public_learning_resource_entries");
    expect(prerender).toContain("public-learning-resource-prerender-report.json");
    expect(prerender).toContain("appendLearningResourceUrlsToSitemap");
    expect(prerender).toContain("injectLearningResourceRedirects");
  });
});
