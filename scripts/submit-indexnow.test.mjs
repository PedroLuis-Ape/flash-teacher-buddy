import { describe, expect, it } from "vitest";
import { extractLocations, validateSelectedUrls } from "./submit-indexnow.mjs";

describe("IndexNow selective submission", () => {
  const published = [
    "https://www.apeeducation.org/",
    "https://www.apeeducation.org/pt-br",
  ];

  it("decodes sitemap locations", () => {
    expect(extractLocations("<urlset><url><loc>https://www.apeeducation.org/a&amp;b</loc></url></urlset>"))
      .toEqual(["https://www.apeeducation.org/a&b"]);
  });

  it("accepts and deduplicates only published canonical URLs", () => {
    expect(validateSelectedUrls([published[0], published[0], published[1]], published)).toEqual(published);
  });

  it("rejects external, insecure and unpublished URLs", () => {
    expect(() => validateSelectedUrls(["https://example.com/"], published)).toThrow(/externa/);
    expect(() => validateSelectedUrls(["http://www.apeeducation.org/"], published)).toThrow(/não HTTPS/);
    expect(() => validateSelectedUrls(["https://www.apeeducation.org/private"], published)).toThrow(/ausente do sitemap/);
  });
});
