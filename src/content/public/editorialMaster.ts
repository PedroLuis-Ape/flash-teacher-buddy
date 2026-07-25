import editorialMetaSource from "../../../config/editorial/editorial-meta.json";
import homeSource from "../../../config/editorial/home.json";
import activitiesSource from "../../../config/editorial/atividades-de-ingles.json";
import flashcardsSource from "../../../config/editorial/flashcards-de-ingles.json";
import beginnersSource from "../../../config/editorial/ingles-para-iniciantes.json";
import teachersSource from "../../../config/editorial/para-professores.json";
import aboutSource from "../../../config/editorial/about.json";
import portalSource from "../../../config/editorial/portal.json";
import ptDocsASource from "../../../config/editorial/pt-docs-a.json";
import ptDocsB1Source from "../../../config/editorial/pt-docs-b1.json";
import ptDocsB2Source from "../../../config/editorial/pt-docs-b2.json";
import enASource from "../../../config/editorial/en-a.json";
import enBSource from "../../../config/editorial/en-b.json";

export interface EditorialLink {
  href: string;
  label: string;
}

export interface EditorialSection {
  heading: string;
  paragraphs: string[];
  items: string[];
}

export interface EditorialFaq {
  question: string;
  answer: string;
}

export interface EditorialHighlight {
  label: string;
  text: string;
}

export interface EditorialReference {
  id: string;
  authors: string;
  year: number;
  title: string;
  publication: string;
  doi: string;
  url: string;
}

export interface EditorialPageDefinition {
  path: string;
  intent: string;
  audience: string;
  title: string;
  description: string;
  h1: string;
  schema: string;
  locale: "pt-BR" | "en";
  cta: {
    primary: string;
    secondary: string;
  };
  intro: string[];
  sections: EditorialSection[];
  faq: EditorialFaq[];
  relatedLinks: EditorialLink[];
  implementationNotes: string[];
  highlights: EditorialHighlight[];
  references?: EditorialReference[];
  datePublished: string;
  dateModified: string;
  author: {
    name: string;
    role: string;
  };
}

export interface EditorialMeta {
  version: string;
  siteUrl: string;
  preply: {
    url: string;
    verifiedAt: string;
    stableLessonClaim: string;
    lessons: number;
    activeStudents: number;
    publicReviews: number;
    publicRating: number;
    anonymousLessonReviews: number;
    dimensions: {
      reliability: number;
      clarity: number;
      progress: number;
      preparation: number;
    };
    certificate: string;
    badges: string[];
    languages: string[];
    specialties: string[];
  };
}

const individualPages = [
  homeSource,
  activitiesSource,
  flashcardsSource,
  beginnersSource,
  teachersSource,
  aboutSource,
  portalSource,
] as unknown as EditorialPageDefinition[];

const groupedPages = [
  ...ptDocsASource,
  ...ptDocsB1Source,
  ...ptDocsB2Source,
  ...enASource,
  ...enBSource,
] as unknown as EditorialPageDefinition[];

export const editorialMeta = editorialMetaSource as EditorialMeta;
export const editorialPages = [...individualPages, ...groupedPages] as EditorialPageDefinition[];

const editorialPageMap = new Map(editorialPages.map((page) => [page.path, page]));

const pairedRoutes: Record<string, string> = {
  "/pt-br": "/en",
  "/pt-br/recursos": "/en/features",
  "/pt-br/flashcards": "/en/flashcards",
  "/pt-br/para-professores": "/en/for-teachers",
  "/pt-br/sobre": "/en/about",
  "/pt-br/fonte-oficial": "/en/official-source",
  "/pt-br/metodologia": "/en/methodology",
  "/pt-br/evidencias": "/en/evidence",
  "/en": "/pt-br",
  "/en/features": "/pt-br/recursos",
  "/en/flashcards": "/pt-br/flashcards",
  "/en/for-teachers": "/pt-br/para-professores",
  "/en/about": "/pt-br/sobre",
  "/en/official-source": "/pt-br/fonte-oficial",
  "/en/methodology": "/pt-br/metodologia",
  "/en/evidence": "/pt-br/evidencias",
};

const routeLabels: Record<string, { pt: string; en: string }> = {
  "/": { pt: "Página inicial", en: "Home" },
  "/portal": { pt: "Portal público", en: "Public portal" },
  "/atividades-de-ingles": { pt: "Atividades de inglês", en: "English activities" },
  "/flashcards-de-ingles": { pt: "Flashcards de inglês", en: "English flashcards" },
  "/ingles-para-iniciantes": { pt: "Inglês para iniciantes", en: "English for beginners" },
  "/para-professores": { pt: "Para professores", en: "For teachers" },
  "/about": { pt: "Sobre o APE", en: "About APE" },
  "/pt-br": { pt: "APE em português", en: "APE in Portuguese" },
  "/pt-br/recursos": { pt: "Recursos do APE", en: "APE features" },
  "/pt-br/flashcards": { pt: "Sistema de flashcards", en: "Flashcard system" },
  "/pt-br/para-professores": { pt: "Documentação para professores", en: "Teacher documentation" },
  "/pt-br/sobre": { pt: "Sobre o projeto", en: "About the project" },
  "/pt-br/fonte-oficial": { pt: "Fonte oficial", en: "Official source" },
  "/pt-br/metodologia": { pt: "Metodologia", en: "Methodology" },
  "/pt-br/evidencias": { pt: "Evidências e limites", en: "Evidence and limits" },
  "/en": { pt: "APE em inglês", en: "APE in English" },
  "/en/features": { pt: "Recursos em inglês", en: "Features" },
  "/en/flashcards": { pt: "Flashcards em inglês", en: "Flashcards" },
  "/en/for-teachers": { pt: "Para professores em inglês", en: "For teachers" },
  "/en/about": { pt: "Sobre em inglês", en: "About" },
  "/en/official-source": { pt: "Fonte oficial em inglês", en: "Official source" },
  "/en/methodology": { pt: "Metodologia em inglês", en: "Methodology" },
  "/en/evidence": { pt: "Evidências em inglês", en: "Evidence" },
};

export function normalizeEditorialPath(pathname: string) {
  if (!pathname || pathname === "/landing") return "/";
  if (pathname.length > 1) return pathname.replace(/\/+$/, "");
  return pathname;
}

export function getEditorialPage(pathname: string) {
  return editorialPageMap.get(normalizeEditorialPath(pathname));
}

export function requireEditorialPage(pathname: string) {
  const page = getEditorialPage(pathname);
  if (!page) throw new Error(`Conteúdo editorial não encontrado para ${pathname}.`);
  return page;
}

export function getPairedEditorialRoute(pathname: string) {
  return pairedRoutes[normalizeEditorialPath(pathname)] ?? null;
}

export function getEditorialRouteLabel(href: string, locale: EditorialPageDefinition["locale"]) {
  if (/^https?:\/\//i.test(href)) {
    if (href.includes("preply.com")) return locale === "en" ? "Pedro Luis on Preply" : "Pedro Luis na Preply";
    if (href.includes("github.com")) return locale === "en" ? "APE source repository" : "Repositório público do APE";
    return href;
  }

  const label = routeLabels[href];
  if (!label) return href;
  return locale === "en" ? label.en : label.pt;
}

export function getEditorialSecondaryHref(page: EditorialPageDefinition) {
  const text = page.cta.secondary.toLocaleLowerCase();
  if (text.includes("portal") || text.includes("materiais") || text.includes("materials")) return "/portal";
  if (text.includes("evid") || text.includes("evidence")) return page.locale === "en" ? "/en/evidence" : "/pt-br/evidencias";
  if (text.includes("metod") || text.includes("method")) return page.locale === "en" ? "/en/methodology" : "/pt-br/metodologia";
  if (text.includes("fonte") || text.includes("official")) return page.locale === "en" ? "/en/official-source" : "/pt-br/fonte-oficial";
  if (text.includes("recurso") || text.includes("feature")) return page.locale === "en" ? "/en/features" : "/pt-br/recursos";
  return page.relatedLinks.find((link) => link.href.startsWith("/"))?.href ?? "/portal";
}

export function splitEditorialHighlight(text: string) {
  return text
    .split(/\s*\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}
