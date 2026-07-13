import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_URL = "https://www.apeeducation.org";
const root = process.cwd();
const distDir = resolve(root, "dist");
const templatePath = resolve(distDir, "index.html");
const pagesPath = resolve(root, "config/public-seo-methodology-evidence.json");
const reportPath = resolve(distDir, "methodology-evidence-prerender-report.json");

export const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const safeJson = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
const absolute = (path) => `${SITE_URL}${path}`;

function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Marcador ausente ao pré-renderizar metodologia/evidências: ${label}`);
  return source.replace(pattern, replacement);
}

export function buildMethodologyEvidenceJsonLd(page) {
  const canonical = absolute(page.path);
  const organizationId = `${SITE_URL}/#organization`;
  const personId = `${SITE_URL}/#pedro-luis-de-oliveira-silva`;
  const websiteId = `${SITE_URL}/#website`;
  const english = page.language === "en";

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": personId,
        name: "Pedro Luis de Oliveira Silva",
        jobTitle: english ? "Founder and creator of APE" : "Fundador e criador do APE",
      },
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "APE Education",
        alternateName: ["APE", "App Piteco"],
        url: `${SITE_URL}/`,
        logo: { "@type": "ImageObject", url: `${SITE_URL}/branding/icon.png` },
        founder: { "@id": personId },
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: "APE — Apprentice Practice & Enhancement",
        alternateName: "App Piteco",
        url: `${SITE_URL}/`,
        inLanguage: ["pt-BR", "en"],
        publisher: { "@id": organizationId },
      },
      {
        "@type": "Article",
        "@id": `${canonical}#article`,
        url: canonical,
        mainEntityOfPage: { "@id": `${canonical}#webpage` },
        headline: page.h1,
        name: page.title,
        description: page.description,
        inLanguage: page.language,
        datePublished: page.datePublished,
        dateModified: page.dateModified,
        author: { "@id": personId },
        publisher: { "@id": organizationId },
        about: [
          { "@type": "Thing", name: english ? "Retrieval practice" : "Prática de recuperação" },
          { "@type": "Thing", name: english ? "Distributed practice" : "Prática distribuída" },
          { "@type": "Thing", name: english ? "Learning transfer" : "Transferência de aprendizagem" },
        ],
        citation: page.references.map((reference) => ({
          "@type": "ScholarlyArticle",
          "@id": reference.url,
          name: reference.title,
          author: reference.authors,
          datePublished: String(reference.year),
          isPartOf: reference.publication,
          sameAs: reference.url,
          identifier: `https://doi.org/${reference.doi}`,
        })),
      },
      {
        "@type": "WebPage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: page.h1,
        description: page.description,
        inLanguage: page.language,
        datePublished: page.datePublished,
        dateModified: page.dateModified,
        isPartOf: { "@id": websiteId },
        mainEntity: { "@id": `${canonical}#article` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: english ? "Home" : "Início",
            item: absolute(english ? "/en" : "/pt-br"),
          },
          { "@type": "ListItem", position: 2, name: page.h1, item: canonical },
        ],
      },
    ],
  };
}

function renderSections(page) {
  return page.sections.map((section) => {
    const paragraphs = (section.paragraphs ?? [])
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join("");
    const items = section.items?.length
      ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";
    return `<section><h2>${escapeHtml(section.heading)}</h2>${paragraphs}${items}</section>`;
  }).join("");
}

function renderReferences(page) {
  return `<section aria-labelledby="research-references"><h2 id="research-references">${escapeHtml(page.referencesHeading)}</h2><p>${escapeHtml(page.referencesIntro)}</p><ol class="research-reference-list">${page.references.map((reference) => `<li id="${escapeHtml(reference.id)}"><p><strong>${escapeHtml(reference.authors)} (${reference.year}).</strong> <cite>${escapeHtml(reference.title)}</cite>. ${escapeHtml(reference.publication)}.</p><a href="${escapeHtml(reference.url)}" rel="external">DOI: ${escapeHtml(reference.doi)}</a></li>`).join("")}</ol></section>`;
}

function renderLinks(page) {
  const label = page.language === "en" ? "Continue reading" : "Continue a leitura";
  return `<nav aria-label="${escapeHtml(label)}"><h2>${escapeHtml(label)}</h2><ul>${page.links.map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join("")}</ul></nav>`;
}

export function renderMethodologyEvidenceStaticContent(page) {
  const homePath = page.language === "en" ? "/en" : "/pt-br";
  const dateLabel = page.language === "en" ? "Published and last reviewed" : "Publicada e revisada em";
  return `<main id="seo-static-content" data-prerendered="true" data-methodology-evidence="${escapeHtml(page.path)}"><article><p class="seo-static-brand"><a href="${homePath}">APE — App Piteco</a></p><header><p class="seo-static-eyebrow">${escapeHtml(page.eyebrow)}</p><h1>${escapeHtml(page.h1)}</h1><p class="seo-static-intro">${escapeHtml(page.intro)}</p><p class="seo-static-updated">${escapeHtml(dateLabel)}: <time datetime="${escapeHtml(page.dateModified)}">${escapeHtml(page.dateModified)}</time></p></header><aside aria-labelledby="evidence-boundary"><h2 id="evidence-boundary">${escapeHtml(page.evidenceNotice.heading)}</h2><p>${escapeHtml(page.evidenceNotice.text)}</p></aside>${renderSections(page)}${renderReferences(page)}${renderLinks(page)}</article></main>`;
}

const style = `<style id="methodology-evidence-static-style">#seo-static-content{min-height:100vh;background:#09001f;color:#f8f7ff;padding:48px 20px;font-family:Nunito,system-ui,sans-serif}#seo-static-content article{max-width:900px;margin:0 auto}#seo-static-content h1{font-size:clamp(2.2rem,6vw,4rem);line-height:1.05;margin:18px 0}#seo-static-content h2{font-size:1.55rem;margin:38px 0 12px}#seo-static-content p,#seo-static-content li{font-size:1.04rem;line-height:1.72;color:#d8d3e6}#seo-static-content a{color:#d7a8ff}#seo-static-content .seo-static-brand{font-weight:800}#seo-static-content .seo-static-eyebrow{display:inline-block;border:1px solid #74439d;border-radius:999px;padding:6px 12px;color:#e3c7fb;font-weight:800}#seo-static-content .seo-static-intro{font-size:1.2rem}#seo-static-content .seo-static-updated{font-size:.9rem}#seo-static-content aside{margin:34px 0;padding:22px;border:1px solid #8b6930;background:#251c08;border-radius:14px}#seo-static-content aside h2{margin:0 0 8px}#seo-static-content ul{padding-left:24px}#seo-static-content .research-reference-list{display:grid;gap:14px;padding-left:24px}#seo-static-content .research-reference-list li{padding:16px;border:1px solid #392653;background:#16072c;border-radius:12px}#seo-static-content .research-reference-list p{margin:0 0 8px}#seo-static-content nav ul{display:grid;gap:10px;list-style:none;padding:0}#seo-static-content nav a{display:block;padding:14px;border:1px solid #392653;border-radius:10px}</style>`;

export function renderMethodologyEvidenceHtml(template, page) {
  const canonical = absolute(page.path);
  const alternateLinks = page.alternates
    .map((alternate) => `<link rel="alternate" hreflang="${escapeHtml(alternate.hrefLang)}" href="${absolute(alternate.href)}" />`)
    .join("\n");
  let html = template;
  html = replaceRequired(html, /<html\s+lang="[^"]+"/i, `<html lang="${escapeHtml(page.language)}"`, "html lang");
  html = replaceRequired(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`, "title");
  html = replaceRequired(html, /<meta name="description" content="[^"]*"\s*\/>/i, `<meta name="description" content="${escapeHtml(page.description)}" />`, "description");
  html = replaceRequired(html, /<link rel="canonical" href="[^"]*"\s*\/>/i, `<link rel="canonical" href="${canonical}" />\n${alternateLinks}`, "canonical");
  html = replaceRequired(html, /<meta property="og:title" content="[^"]*"\s*\/>/i, `<meta property="og:title" content="${escapeHtml(page.title)}" />`, "og:title");
  html = replaceRequired(html, /<meta property="og:description" content="[^"]*"\s*\/>/i, `<meta property="og:description" content="${escapeHtml(page.description)}" />`, "og:description");
  html = replaceRequired(html, /<meta property="og:url" content="[^"]*"\s*\/>/i, `<meta property="og:url" content="${canonical}" />`, "og:url");
  html = replaceRequired(html, /<meta property="og:locale" content="[^"]*"\s*\/>/i, `<meta property="og:locale" content="${page.language.replace("-", "_")}" />`, "og:locale");
  html = replaceRequired(html, /<meta name="twitter:title" content="[^"]*"\s*\/>/i, `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`, "twitter:title");
  html = replaceRequired(html, /<meta name="twitter:description" content="[^"]*"\s*\/>/i, `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`, "twitter:description");
  html = replaceRequired(html, /<\/head>/i, `${style}\n<script id="methodology-evidence-jsonld" type="application/ld+json">${safeJson(buildMethodologyEvidenceJsonLd(page))}</script>\n</head>`, "head");
  html = replaceRequired(html, /<div id="root"><\/div>/i, `<div id="root">${renderMethodologyEvidenceStaticContent(page)}</div>`, "root");
  return `<!-- Generated by scripts/prerender-methodology-evidence.mjs for ${page.path} -->\n${html}`;
}

export async function prerenderMethodologyEvidence() {
  if (!existsSync(templatePath)) throw new Error("dist/index.html não encontrado.");
  const template = readFileSync(templatePath, "utf8");
  const pages = JSON.parse(readFileSync(pagesPath, "utf8"));
  const generatedPaths = [];

  for (const page of pages) {
    const destination = resolve(distDir, page.path.slice(1), "index.html");
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, renderMethodologyEvidenceHtml(template, page), "utf8");
    generatedPaths.push(page.path);
    console.log(`Pré-render metodologia/evidências: ${page.path}`);
  }

  const report = { generatedAt: new Date().toISOString(), pageCount: pages.length, generatedPaths };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectExecution) {
  prerenderMethodologyEvidence().catch((error) => {
    console.error("Falha na pré-renderização de metodologia/evidências:", error);
    process.exit(1);
  });
}
