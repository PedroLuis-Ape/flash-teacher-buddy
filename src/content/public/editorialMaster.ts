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
import internationalSource from "../../../config/editorial/international-locales.json";

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
  landingDemo?: {
    label: string;
    context: string;
    prompt: string;
    instruction: string;
    answerLabel: string;
    answer: string;
    caption: string;
  };
  path: string;
  intent: string;
  audience: string;
  title: string;
  description: string;
  h1: string;
  schema: string;
  locale: "pt-BR" | "en" | "es" | "fr" | "it" | "de";
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

export type EditorialLocale = EditorialPageDefinition["locale"];

export interface EditorialLocaleCopy {
  home: string;
  related: string;
  explore: string;
  section: string;
  faq: string;
  faqIntro: string;
  published: string;
  reviewed: string;
  author: string;
  verify: string;
  language: string;
  imageAlt: string;
  homeLabel: string;
  role: string;
  jobTitle: string;
  breadcrumb: string;
}

type InternationalSource = {
  version: number;
  datePublished: string;
  dateModified: string;
  locales: Record<Exclude<EditorialLocale, "pt-BR" | "en">, {
    language: Exclude<EditorialLocale, "pt-BR" | "en">;
    paths: Record<string, string>;
    ui: EditorialLocaleCopy;
    pages: Record<string, Omit<EditorialPageDefinition, "path" | "locale" | "relatedLinks" | "implementationNotes" | "highlights" | "datePublished" | "dateModified" | "author" | "landingDemo" | "references">>;
  }>;
};

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

const localizedSource = internationalSource as unknown as InternationalSource;
const localizedLocales = Object.keys(localizedSource.locales) as Array<Exclude<EditorialLocale, "pt-BR" | "en">>;

const localizedPages = localizedLocales.flatMap((locale) => {
  const source = localizedSource.locales[locale];
  return Object.entries(source.pages).map(([key, page]) => ({
    ...page,
    path: source.paths[key],
    locale,
    intent: `Apresentar o APE em ${locale}.`,
    cta: {
      primary: locale === "de" ? "APE öffnen" : locale === "es" ? "Empezar a practicar" : locale === "fr" ? "Commencer à pratiquer" : "Inizia a praticare",
      secondary: locale === "de" ? "Öffentliche Materialien" : locale === "es" ? "Materiales públicos" : locale === "fr" ? "Matériel public" : "Materiali pubblici",
    },
    relatedLinks: Object.entries(source.paths)
      .filter(([relatedKey]) => relatedKey !== key)
      .slice(0, 3)
      .map(([relatedKey, href]) => ({ href, label: relatedKey })),
    implementationNotes: ["Conteúdo editorial localizado a partir do registro internacional canônico."],
    highlights: [],
    datePublished: localizedSource.datePublished,
    dateModified: localizedSource.dateModified,
    author: { name: "Pedro Luis", role: source.ui.role },
  })) as EditorialPageDefinition[];
});

export const editorialMeta = editorialMetaSource as EditorialMeta;
export const editorialPages = [...individualPages, ...groupedPages, ...localizedPages] as EditorialPageDefinition[];

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

const localeFamilies: Record<string, Record<EditorialLocale, string>> = {
  home: { "pt-BR": "/pt-br", en: "/en", ...Object.fromEntries(localizedLocales.map((locale) => [locale, localizedSource.locales[locale].paths.home])) } as Record<EditorialLocale, string>,
  features: { "pt-BR": "/pt-br/recursos", en: "/en/features", ...Object.fromEntries(localizedLocales.map((locale) => [locale, localizedSource.locales[locale].paths.features])) } as Record<EditorialLocale, string>,
  flashcards: { "pt-BR": "/pt-br/flashcards", en: "/en/flashcards", ...Object.fromEntries(localizedLocales.map((locale) => [locale, localizedSource.locales[locale].paths.flashcards])) } as Record<EditorialLocale, string>,
  teachers: { "pt-BR": "/pt-br/para-professores", en: "/en/for-teachers", ...Object.fromEntries(localizedLocales.map((locale) => [locale, localizedSource.locales[locale].paths.teachers])) } as Record<EditorialLocale, string>,
  about: { "pt-BR": "/pt-br/sobre", en: "/en/about", ...Object.fromEntries(localizedLocales.map((locale) => [locale, localizedSource.locales[locale].paths.about])) } as Record<EditorialLocale, string>,
  official: { "pt-BR": "/pt-br/fonte-oficial", en: "/en/official-source", ...Object.fromEntries(localizedLocales.map((locale) => [locale, localizedSource.locales[locale].paths.official])) } as Record<EditorialLocale, string>,
  methodology: { "pt-BR": "/pt-br/metodologia", en: "/en/methodology", ...Object.fromEntries(localizedLocales.map((locale) => [locale, localizedSource.locales[locale].paths.methodology])) } as Record<EditorialLocale, string>,
  evidence: { "pt-BR": "/pt-br/evidencias", en: "/en/evidence", ...Object.fromEntries(localizedLocales.map((locale) => [locale, localizedSource.locales[locale].paths.evidence])) } as Record<EditorialLocale, string>,
};

const routeFamilyByPath = new Map(
  Object.entries(localeFamilies).flatMap(([family, routes]) => Object.entries(routes).map(([locale, path]) => [path, { family, locale: locale as EditorialLocale }] as const)),
);

const familyLabels: Record<EditorialLocale, Record<string, string>> = {
  "pt-BR": { home: "Página inicial", features: "Recursos do APE", flashcards: "Sistema de flashcards", teachers: "Para professores", about: "Sobre o projeto", official: "Fonte oficial", methodology: "Metodologia", evidence: "Evidências e limites" },
  en: { home: "Home", features: "APE features", flashcards: "Flashcard system", teachers: "For teachers", about: "About the project", official: "Official source", methodology: "Methodology", evidence: "Evidence and limits" },
  es: { home: "Inicio", features: "Recursos de APE", flashcards: "Sistema de flashcards", teachers: "Para profesores", about: "Sobre el proyecto", official: "Fuente oficial", methodology: "Metodología", evidence: "Evidencias y límites" },
  fr: { home: "Accueil", features: "Fonctionnalités d’APE", flashcards: "Système de flashcards", teachers: "Pour enseignants", about: "À propos du projet", official: "Source officielle", methodology: "Méthodologie", evidence: "Preuves et limites" },
  it: { home: "Home", features: "Funzioni di APE", flashcards: "Sistema di flashcard", teachers: "Per insegnanti", about: "Informazioni sul progetto", official: "Fonte ufficiale", methodology: "Metodologia", evidence: "Prove e limiti" },
  de: { home: "Startseite", features: "APE-Funktionen", flashcards: "Lernkartensystem", teachers: "Für Lehrkräfte", about: "Über das Projekt", official: "Offizielle Quelle", methodology: "Methodik", evidence: "Belege und Grenzen" },
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

const editorialLocaleCopies: Record<EditorialLocale, EditorialLocaleCopy> = {
  "pt-BR": {
    home: "Início", related: "Páginas relacionadas", explore: "Continue explorando", section: "Seção", faq: "Perguntas frequentes", faqIntro: "Respostas diretas baseadas no conteúdo visível e revisado desta página.", published: "Publicada em", reviewed: "última revisão", author: "Autoria e contexto profissional", verify: "Verificar na Preply", language: "English/Español/Français/Italiano/Deutsch", imageAlt: "Página editorial pública do APE", homeLabel: "APE em português", role: "Criador de APE — App Piteco", jobTitle: "Professor de inglês e criador do APE", breadcrumb: "Início",
  },
  en: {
    home: "Home", related: "Related pages", explore: "Continue exploring", section: "Section", faq: "Frequently asked questions", faqIntro: "Direct answers based on the visible, reviewed content of this page.", published: "Published", reviewed: "last reviewed", author: "Authorship and professional context", verify: "Verify on Preply", language: "Português/Español/Français/Italiano/Deutsch", imageAlt: "APE editorial public page", homeLabel: "APE in English", role: "Creator of APE — App Piteco", jobTitle: "English tutor and creator of APE", breadcrumb: "Home",
  },
  ...Object.fromEntries(localizedLocales.map((locale) => [locale, localizedSource.locales[locale].ui])) as Record<Exclude<EditorialLocale, "pt-BR" | "en">, EditorialLocaleCopy>,
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

export function getEditorialLocaleCopy(locale: EditorialLocale) {
  return editorialLocaleCopies[locale];
}

export function getEditorialHomePath(locale: EditorialLocale) {
  if (locale === "pt-BR") return "/pt-br";
  if (locale === "en") return "/en";
  return localizedSource.locales[locale].paths.home;
}

export function getEditorialAlternates(pathname: string) {
  const normalized = normalizeEditorialPath(pathname);
  const family = routeFamilyByPath.get(normalized);
  if (!family) {
    if (normalized !== "/") return [];
    return [
      { hrefLang: "pt-BR", href: "/" },
      ...Object.entries(localeFamilies.home).filter(([locale]) => locale !== "pt-BR").map(([hrefLang, href]) => ({ hrefLang, href })),
      { hrefLang: "x-default", href: "/" },
    ];
  }
  return [
    ...Object.entries(localeFamilies[family.family]).map(([locale, href]) => ({ hrefLang: locale, href })),
    { hrefLang: "x-default", href: "/" },
  ];
}

export function getEditorialLocaleSwitch(pathname: string) {
  const normalized = normalizeEditorialPath(pathname);
  const family = routeFamilyByPath.get(normalized);
  if (!family) return getPairedEditorialRoute(normalized);
  const currentIndex = Object.keys(localeFamilies[family.family]).indexOf(family.locale);
  const locales = Object.keys(localeFamilies[family.family]);
  const targetLocale = locales[(currentIndex + 1) % locales.length] as EditorialLocale;
  return localeFamilies[family.family][targetLocale];
}

export function getEditorialFamilyRoutes() {
  return localeFamilies;
}

export function getEditorialRouteLabel(href: string, locale: EditorialPageDefinition["locale"]) {
  if (/^https?:\/\//i.test(href)) {
    if (href.includes("preply.com")) return locale === "en" ? "Pedro Luis on Preply" : locale === "pt-BR" ? "Pedro Luis na Preply" : "Pedro Luis on Preply";
    if (href.includes("github.com")) return locale === "en" ? "APE source repository" : locale === "pt-BR" ? "Repositório público do APE" : "APE source repository";
    return href;
  }

  const label = routeLabels[href];
  const family = routeFamilyByPath.get(href);
  if (family) return familyLabels[locale][family.family];
  if (!label) return href;
  return locale === "en" ? label.en : locale === "pt-BR" ? label.pt : href;
}

export function getEditorialSecondaryHref(page: EditorialPageDefinition) {
  const text = page.cta.secondary.toLocaleLowerCase();
  if (text.includes("portal") || text.includes("materiais") || text.includes("materials")) return "/portal";
  const localeRoutes = page.locale === "pt-BR" ? null : page.locale === "en" ? null : localizedSource.locales[page.locale];
  if (text.includes("evid") || text.includes("evidence")) return page.locale === "en" ? "/en/evidence" : page.locale === "pt-BR" ? "/pt-br/evidencias" : localeRoutes!.paths.evidence;
  if (text.includes("metod") || text.includes("method")) return page.locale === "en" ? "/en/methodology" : page.locale === "pt-BR" ? "/pt-br/metodologia" : localeRoutes!.paths.methodology;
  if (text.includes("fonte") || text.includes("official") || text.includes("offizi")) return page.locale === "en" ? "/en/official-source" : page.locale === "pt-BR" ? "/pt-br/fonte-oficial" : localeRoutes!.paths.official;
  if (text.includes("recurso") || text.includes("feature") || text.includes("funktion") || text.includes("ressource") || text.includes("risorse")) return page.locale === "en" ? "/en/features" : page.locale === "pt-BR" ? "/pt-br/recursos" : localeRoutes!.paths.features;
  return page.relatedLinks.find((link) => link.href.startsWith("/"))?.href ?? "/portal";
}

export function splitEditorialHighlight(text: string) {
  return text
    .split(/\s*\|\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}
