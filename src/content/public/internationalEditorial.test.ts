import { describe, expect, it } from "vitest";
import {
  editorialPages,
  getEditorialAlternates,
  getEditorialPage,
} from "@/content/public/editorialMaster";

const localizedPaths = [
  "/es", "/es/recursos", "/es/flashcards", "/es/para-profesores", "/es/sobre", "/es/fuente-oficial", "/es/metodologia", "/es/evidencias",
  "/fr", "/fr/ressources", "/fr/flashcards", "/fr/pour-enseignants", "/fr/a-propos", "/fr/source-officielle", "/fr/methodologie", "/fr/preuves",
  "/it", "/it/risorse", "/it/flashcards", "/it/per-insegnanti", "/it/informazioni", "/it/fonte-ufficiale", "/it/metodologia", "/it/evidenze",
  "/de", "/de/funktionen", "/de/lernkartei", "/de/fuer-lehrkraefte", "/de/ueber-ape", "/de/offizielle-quelle", "/de/methodik", "/de/evidenz",
];

describe("international editorial registry", () => {
  it("exposes complete localized pages with localized copy", () => {
    expect(localizedPaths).toHaveLength(32);
    for (const path of localizedPaths) {
      const page = getEditorialPage(path);
      expect(page?.locale).toMatch(/^(es|fr|it|de)$/);
      expect(page?.title).not.toBe("");
      expect(page?.h1).not.toBe("");
      expect(page?.intro.length).toBeGreaterThan(0);
      expect(page?.sections.length).toBeGreaterThan(0);
      expect(editorialPages.some((candidate) => candidate.path === path)).toBe(true);
    }
  });

  it("emits reciprocal six-locale alternates plus x-default", () => {
    const alternates = getEditorialAlternates("/de/methodik");
    expect(alternates.map((alternate) => alternate.hrefLang)).toEqual([
      "pt-BR", "en", "es", "fr", "it", "de", "x-default",
    ]);
    expect(alternates.find((alternate) => alternate.hrefLang === "fr")?.href).toBe("/fr/methodologie");
    expect(alternates.find((alternate) => alternate.hrefLang === "x-default")?.href).toBe("/");
  });
});
