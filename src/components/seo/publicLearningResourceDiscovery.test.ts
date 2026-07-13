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

  it("keeps editorial materials strict without breaking active public classrooms", () => {
    const discoveryMigration = readFileSync(
      "supabase/migrations/20260713134000_public_learning_resource_discovery.sql",
      "utf8",
    );
    const compatibilityMigration = readFileSync(
      "supabase/migrations/20260713134600_public_learning_resource_compatibility.sql",
      "utf8",
    );
    const canonicalCountsMigration = readFileSync(
      "supabase/migrations/20260713134700_public_learning_resource_canonical_counts.sql",
      "utf8",
    );

    expect(discoveryMigration).toContain("list_public_learning_resource_entries");
    expect(discoveryMigration).toContain("get_public_learning_resource_lists");
    expect(discoveryMigration.match(/l\.visibility = 'class'/g)?.length).toBeGreaterThanOrEqual(6);
    expect(discoveryMigration.match(/l\.class_id IS NULL/g)?.length).toBeGreaterThanOrEqual(6);
    expect(discoveryMigration).toContain("fc.user_id = f.owner_id");

    expect(compatibilityMigration).toContain("fc.parent_card_id IS NULL");
    expect(compatibilityMigration).toContain("t.public = true");
    expect(compatibilityMigration).toContain("t.ativo = true");
    expect(compatibilityMigration).toContain("a.fonte_tipo::text = 'lista'");
    expect(compatibilityMigration).toContain("a.fonte_tipo::text = 'pasta'");
    expect(compatibilityMigration).toContain("REVOKE ALL ON FUNCTION");
    expect(compatibilityMigration).toContain("GRANT EXECUTE");

    expect(canonicalCountsMigration.match(/fc\.parent_card_id IS NULL/g)).toHaveLength(3);
    expect(canonicalCountsMigration).toContain("list_public_learning_resource_entries");
    expect(canonicalCountsMigration).toContain("get_public_learning_resource(");
    expect(canonicalCountsMigration).toContain("get_public_learning_resource_lists");
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
