import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const distDir = resolve(root, "dist");
const templatePath = resolve(distDir, "index.html");
const pagesPath = resolve(root, "config/public-seo-pages-international.json");
const officialSourcesPath = resolve(root, "config/public-seo-official-sources.json");
const siteUrl = "https://www.apeeducation.org";

if (!existsSync(templatePath)) throw new Error("dist/index.html não encontrado.");

const template = readFileSync(templatePath, "utf8");
const pages = [
  ...JSON.parse(readFileSync(pagesPath, "utf8")),
  ...JSON.parse(readFileSync(officialSourcesPath, "utf8")),
];

const escapeHtml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const safeJson = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");

function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Marcador ausente: ${label}`);
  return source.replace(pattern, replacement);
}

function absolute(path) {
  return `${siteUrl}${path === "/" ? "/" : path}`;
}

function renderSection(section) {
  const paragraphs = (section.paragraphs ?? []).map((item) => `<p>${escapeHtml(item)}</p>`).join("\n");
  const items = section.items?.length
    ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  return `<section><h2>${escapeHtml(section.heading)}</h2>${paragraphs}${items}</section>`;
}

function renderCitation(page) {
  if (!page.citation) return "";
  return `<section class="seo-static-citation"><h2>${escapeHtml(page.citation.heading)}</h2><p>${escapeHtml(page.citation.intro)}</p><blockquote>${escapeHtml(page.citation.text)}</blockquote></section>`;
}

function renderFaqs(page) {
  if (!page.faqs?.length) return "";
  const heading = page.language === "en" ? "Frequently asked factual questions" : "Perguntas factuais frequentes";
  const entries = page.faqs
    .map((faq) => `<section class="seo-static-faq"><h3>${escapeHtml(faq.question)}</h3><p>${escapeHtml(faq.answer)}</p></section>`)
    .join("\n");
  return `<section><h2>${escapeHtml(heading)}</h2>${entries}</section>`;
}

function renderContent(page) {
  const relatedLabel = page.language === "en" ? "Related pages" : "Explore também";
  const homeHref = page.language === "en" ? "/en" : "/pt-br";
  const updatedLabel = page.language === "en" ? "Last editorial review" : "Última revisão editorial";
  const sections = page.sections.map(renderSection).join("\n");
  const updated = page.dateModified
    ? `<p class="seo-static-updated">${escapeHtml(updatedLabel)}: <time datetime="${escapeHtml(page.dateModified)}">${escapeHtml(page.dateModified)}</time></p>`
    : "";
  const citation = renderCitation(page);
  const faqs = renderFaqs(page);
  const links = page.links?.length
    ? `<nav aria-label="${escapeHtml(relatedLabel)}"><h2>${escapeHtml(relatedLabel)}</h2><ul>${page.links.map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join("")}</ul></nav>`
    : "";
  return `<main id="seo-static-content" data-prerendered="true" data-language="${escapeHtml(page.language)}"><article><p class="seo-static-brand"><a href="${homeHref}">APE — App Piteco</a></p><h1>${escapeHtml(page.h1)}</h1><p class="seo-static-intro">${escapeHtml(page.intro)}</p>${updated}${sections}${citation}${faqs}${links}</article></main>`;
}

function buildJsonLd(page) {
  const canonical = absolute(page.path);
  const homePath = page.language === "en" ? "/en" : "/pt-br";
  const homeLabel = page.language === "en" ? "Home" : "Início";
  const organizationId = `${siteUrl}/#organization`;
  const personId = `${siteUrl}/#pedro-luis-de-oliveira-silva`;
  const applicationId = `${siteUrl}/#application`;
  const faqId = `${canonical}#faq`;
  const graph = [];

  if (page.officialSource) {
    graph.push({
      "@type": "Person",
      "@id": personId,
      name: "Pedro Luis de Oliveira Silva",
      jobTitle: page.language === "en" ? "Founder and creator of APE" : "Fundador e criador do APE",
    });
  }

  const organization = {
    "@type": "Organization",
    "@id": organizationId,
    name: "APE Education",
    alternateName: ["APE", "App Piteco"],
    url: `${siteUrl}/`,
    logo: { "@type": "ImageObject", url: `${siteUrl}/branding/icon.png` },
  };
  if (page.officialSource) organization.founder = { "@id": personId };
  graph.push(organization);

  if (page.officialSource) {
    graph.push({
      "@type": ["SoftwareApplication", "EducationalApplication"],
      "@id": applicationId,
      name: "APE — Apprentice Practice & Enhancement",
      alternateName: "App Piteco",
      url: `${siteUrl}/`,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      inLanguage: ["pt-BR", "en"],
      creator: { "@id": personId },
      publisher: { "@id": organizationId },
      featureList: page.featureList ?? [],
    });
  }

  graph.push({
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: "APE — Apprentice Practice & Enhancement",
    alternateName: "App Piteco",
    url: `${siteUrl}/`,
    inLanguage: ["pt-BR", "en"],
    publisher: { "@id": organizationId },
  });

  if (page.path !== homePath) {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${canonical}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: homeLabel, item: absolute(homePath) },
        { "@type": "ListItem", position: 2, name: page.h1, item: canonical },
      ],
    });
  }

  const pageNode = {
    "@type": page.schemaType === "LearningResource" ? "WebPage" : page.schemaType,
    "@id": `${canonical}#webpage`,
    url: canonical,
    name: page.h1,
    headline: page.title,
    description: page.description,
    inLanguage: page.language,
    isPartOf: { "@id": `${siteUrl}/#website` },
    publisher: { "@id": organizationId },
  };

  if (page.officialSource) {
    pageNode.dateModified = page.dateModified;
    pageNode.about = [{ "@id": applicationId }, { "@id": organizationId }, { "@id": personId }];
    pageNode.mainEntity = { "@id": faqId };
  }
  graph.push(pageNode);

  if (page.schemaType === "LearningResource") {
    graph.push({
      "@type": "LearningResource",
      "@id": `${canonical}#learning-resource`,
      name: page.h1,
      description: page.description,
      url: canonical,
      inLanguage: page.language,
      provider: { "@id": organizationId },
      mainEntityOfPage: { "@id": `${canonical}#webpage` },
    });
  }

  if (page.officialSource && page.faqs?.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": faqId,
      mainEntity: page.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    });
  }

  return { "@context": "https://schema.org", "@graph": graph };
}

const style = `<style id="seo-static-style">#seo-static-content{min-height:100vh;background:#09001f;color:#f8f7ff;padding:48px 20px;font-family:Nunito,system-ui,sans-serif}#seo-static-content article{max-width:850px;margin:0 auto}#seo-static-content h1{font-size:clamp(2rem,6vw,4rem);line-height:1.05;margin:18px 0}#seo-static-content h2{font-size:1.5rem;margin:34px 0 10px}#seo-static-content h3{font-size:1.12rem;margin:0}#seo-static-content p,#seo-static-content li{font-size:1.05rem;line-height:1.7;color:#d8d3e6}#seo-static-content a{color:#d7a8ff}#seo-static-content .seo-static-brand{font-weight:800}#seo-static-content .seo-static-intro{font-size:1.2rem}#seo-static-content .seo-static-updated{font-size:.9rem}#seo-static-content ul{padding-left:24px}#seo-static-content blockquote{margin:16px 0;padding:18px;border-left:4px solid #b66cff;background:#16072c;border-radius:10px;font-size:1.08rem;line-height:1.65}#seo-static-content .seo-static-faq{margin:12px 0;padding:16px;border:1px solid #392653;border-radius:12px}</style>`;

for (const page of pages) {
  const canonical = absolute(page.path);
  const alternateLinks = page.alternates.map((item) => `<link rel="alternate" hreflang="${escapeHtml(item.hrefLang)}" href="${absolute(item.href)}" />`).join("\n");
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
  html = replaceRequired(html, /<\/head>/i, `${style}\n<script id="seo-static-jsonld" type="application/ld+json">${safeJson(buildJsonLd(page))}</script>\n</head>`, "head");
  html = replaceRequired(html, /<div id="root"><\/div>/i, `<div id="root">${renderContent(page)}</div>`, "root");
  html = `<!-- Generated by scripts/prerender-international-pages.mjs for ${page.path} -->\n${html}`;

  const destination = resolve(distDir, page.path.slice(1), "index.html");
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, html, "utf8");
  console.log(`Pré-render internacional: ${page.path}`);
}

console.log(`Pré-renderização internacional concluída para ${pages.length} rotas.`);
