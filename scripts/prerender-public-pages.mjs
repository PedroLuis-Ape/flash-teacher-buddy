import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadEditorialMeta, loadEditorialPages } from "./load-editorial-pages.mjs";

const root = process.cwd();
const distDir = resolve(root, "dist");
const templatePath = resolve(distDir, "index.html");
const meta = loadEditorialMeta(root);
const pages = loadEditorialPages(root);
const siteUrl = meta.siteUrl;
const organizationId = `${siteUrl}/#organization`;
const websiteId = `${siteUrl}/#website`;
const applicationId = `${siteUrl}/#application`;
const personId = `${siteUrl}/#pedro-luis`;

const pairedRoutes = {
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

if (!existsSync(templatePath)) {
  console.error("ERRO: dist/index.html não encontrado. Execute o build do Vite primeiro.");
  process.exit(1);
}

const template = readFileSync(templatePath, "utf8");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeJson(value) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function absolute(path) {
  if (/^https?:\/\//i.test(path)) return path;
  return path === "/" ? `${siteUrl}/` : `${siteUrl}${path}`;
}

function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Marcador obrigatório não encontrado em index.html: ${label}`);
  return source.replace(pattern, replacement);
}

function renderItems(items = []) {
  if (!items.length) return "";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderParagraphs(paragraphs = []) {
  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("\n");
}

function renderSections(page) {
  return page.sections
    .map((section, index) => `<section><p class="seo-static-kicker">${page.locale === "en" ? "Section" : "Seção"} ${index + 1}</p><h2>${escapeHtml(section.heading)}</h2>${renderParagraphs(section.paragraphs)}${renderItems(section.items)}</section>`)
    .join("\n");
}

function renderHighlights(page) {
  return (page.highlights ?? []).map((highlight) => {
    const parts = String(highlight.text).split(/\s*\|\s*/).filter(Boolean);
    const body = parts.length > 1
      ? `<ol>${parts.map((part) => `<li>${escapeHtml(part)}</li>`).join("")}</ol>`
      : `<p>${escapeHtml(highlight.text)}</p>`;
    return `<aside><h2>${escapeHtml(highlight.label)}</h2>${body}</aside>`;
  }).join("\n");
}

function renderFaq(page) {
  if (!page.faq?.length) return "";
  return `<section><h2>${page.locale === "en" ? "Frequently asked questions" : "Perguntas frequentes"}</h2>${page.faq.map((faq) => `<article><h3>${escapeHtml(faq.question)}</h3><p>${escapeHtml(faq.answer)}</p></article>`).join("")}</section>`;
}

function renderReferences(page) {
  if (!page.references?.length) return "";
  return `<section><h2>${page.locale === "en" ? "Research references" : "Referências de pesquisa"}</h2><p>${page.locale === "en" ? "These publications study general learning principles and did not directly evaluate APE." : "Estas publicações estudam princípios gerais de aprendizagem e não avaliaram diretamente o APE."}</p><ol>${page.references.map((reference) => `<li id="${escapeHtml(reference.id)}"><strong>${escapeHtml(reference.authors)} (${reference.year}).</strong> <em>${escapeHtml(reference.title)}.</em> ${escapeHtml(reference.publication)}. <a href="${escapeHtml(reference.url)}">DOI: ${escapeHtml(reference.doi)}</a></li>`).join("")}</ol></section>`;
}

function renderRelatedLinks(page) {
  if (!page.relatedLinks?.length) return "";
  return `<nav aria-label="${page.locale === "en" ? "Related pages" : "Páginas relacionadas"}"><h2>${page.locale === "en" ? "Continue exploring" : "Continue explorando"}</h2><ul>${page.relatedLinks.map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`).join("")}</ul></nav>`;
}

function renderStaticContent(page) {
  const intro = renderParagraphs(page.intro);
  const authorText = page.locale === "en"
    ? `Pedro Luis is a Brazilian English tutor and the creator of APE. His public Preply profile documents more than 1,900 lessons taught and a verified teaching certificate. These credentials describe the creator, not a scientific rating of the software.`
    : `Pedro Luis é professor brasileiro de inglês e criador do APE. Seu perfil público na Preply registra ${escapeHtml(meta.preply.stableLessonClaim)} e certificado de ensino verificado. Essas credenciais descrevem o criador, não uma avaliação científica do software.`;

  return `<main id="seo-static-content" data-prerendered="true">
  <article>
    <p class="seo-static-brand"><a href="/">APE — App Piteco</a></p>
    <h1>${escapeHtml(page.h1)}</h1>
    <div class="seo-static-intro">${intro}</div>
    ${renderHighlights(page)}
    ${renderSections(page)}
    ${renderFaq(page)}
    ${renderReferences(page)}
    <section><h2>${page.locale === "en" ? "Authorship and professional context" : "Autoria e contexto profissional"}</h2><p><strong>${escapeHtml(page.author.name)}</strong> — ${escapeHtml(page.author.role)}</p><p>${authorText}</p><p><a href="${escapeHtml(meta.preply.url)}">${page.locale === "en" ? "Verify the public Preply profile" : "Verificar perfil público na Preply"}</a></p><p>${page.locale === "en" ? "Last reviewed" : "Última revisão"}: ${escapeHtml(page.dateModified)}.</p></section>
    ${renderRelatedLinks(page)}
  </article>
</main>`;
}

function pageType(page) {
  if (page.schema.includes("AboutPage")) return "AboutPage";
  if (page.schema.includes("CollectionPage")) return "CollectionPage";
  return "WebPage";
}

function buildSchema(page) {
  const canonical = absolute(page.path);
  const pageId = `${canonical}#webpage`;
  const articleId = `${canonical}#article`;
  const resourceId = `${canonical}#learning-resource`;
  const faqId = `${canonical}#faq`;
  const english = page.locale === "en";
  const graph = [
    {
      "@type": "Person",
      "@id": personId,
      name: "Pedro Luis",
      jobTitle: english ? "English tutor and creator of APE" : "Professor de inglês e criador do APE",
      sameAs: [meta.preply.url, "https://github.com/PedroLuis-Ape", "https://github.com/PedroLuis-Ape/flash-teacher-buddy"],
      knowsLanguage: ["pt-BR", "en"],
    },
    {
      "@type": "Organization",
      "@id": organizationId,
      name: "APE Education",
      alternateName: ["APE", "App Piteco"],
      url: `${siteUrl}/`,
      logo: { "@type": "ImageObject", url: `${siteUrl}/branding/icon.png` },
      founder: { "@id": personId },
    },
    {
      "@type": "WebSite",
      "@id": websiteId,
      name: "APE — Apprentice Practice & Enhancement",
      alternateName: "App Piteco",
      url: `${siteUrl}/`,
      inLanguage: ["pt-BR", "en"],
      publisher: { "@id": organizationId },
    },
    {
      "@type": ["SoftwareApplication", "EducationalApplication"],
      "@id": applicationId,
      name: "APE — Apprentice Practice & Enhancement",
      alternateName: "App Piteco",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      inLanguage: ["pt-BR", "en"],
      url: `${siteUrl}/`,
      creator: { "@id": personId },
      publisher: { "@id": organizationId },
    },
  ];
  const mainEntity = [];

  if (page.path !== "/") {
    graph.push({
      "@type": "BreadcrumbList",
      "@id": `${canonical}#breadcrumb`,
      itemListElement: [
        { "@type": "ListItem", position: 1, name: english ? "Home" : "Início", item: absolute(english ? "/en" : "/") },
        { "@type": "ListItem", position: 2, name: page.h1, item: canonical },
      ],
    });
  }

  if (page.schema.includes("Article")) {
    graph.push({
      "@type": "Article",
      "@id": articleId,
      url: canonical,
      mainEntityOfPage: { "@id": pageId },
      headline: page.h1,
      name: page.title,
      description: page.description,
      inLanguage: page.locale,
      datePublished: page.datePublished,
      dateModified: page.dateModified,
      author: { "@id": personId },
      publisher: { "@id": organizationId },
      citation: (page.references ?? []).map((reference) => ({
        "@type": "ScholarlyArticle",
        "@id": reference.url,
        name: reference.title,
        author: reference.authors,
        datePublished: String(reference.year),
        isPartOf: reference.publication,
        sameAs: reference.url,
        identifier: `https://doi.org/${reference.doi}`,
      })),
    });
    mainEntity.push({ "@id": articleId });
  }

  if (page.schema.includes("LearningResource")) {
    graph.push({
      "@type": "LearningResource",
      "@id": resourceId,
      name: page.h1,
      description: page.description,
      url: canonical,
      inLanguage: page.locale,
      datePublished: page.datePublished,
      dateModified: page.dateModified,
      provider: { "@id": organizationId },
      author: { "@id": personId },
      mainEntityOfPage: { "@id": pageId },
    });
    mainEntity.push({ "@id": resourceId });
  }

  if (page.faq?.length) {
    graph.push({
      "@type": "FAQPage",
      "@id": faqId,
      mainEntity: page.faq.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    });
    mainEntity.push({ "@id": faqId });
  }

  graph.push({
    "@type": pageType(page),
    "@id": pageId,
    url: canonical,
    name: page.h1,
    headline: page.title,
    description: page.description,
    inLanguage: page.locale,
    datePublished: page.datePublished,
    dateModified: page.dateModified,
    isPartOf: { "@id": websiteId },
    about: { "@id": applicationId },
    author: { "@id": personId },
    publisher: { "@id": organizationId },
    ...(page.path !== "/" ? { breadcrumb: { "@id": `${canonical}#breadcrumb` } } : {}),
    mainEntity: mainEntity.length ? mainEntity : { "@id": applicationId },
  });

  return { "@context": "https://schema.org", "@graph": graph };
}

function alternateLinks(page) {
  const pair = pairedRoutes[page.path];
  const entries = [];
  if (page.path === "/") {
    entries.push(["pt-BR", "/"], ["en", "/en"], ["x-default", "/"]);
  } else if (pair) {
    entries.push([page.locale, page.path], [page.locale === "en" ? "pt-BR" : "en", pair], ["x-default", page.locale === "en" ? pair : page.path]);
  }
  return entries.map(([lang, path]) => `<link rel="alternate" hreflang="${lang}" href="${absolute(path)}" />`).join("\n");
}

const staticStyle = `<style id="seo-static-style">
#seo-static-content{min-height:100vh;background:#09001f;color:#f8f7ff;padding:48px 20px;font-family:Nunito,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
#seo-static-content article{max-width:920px;margin:0 auto}
#seo-static-content h1{font-size:clamp(2.25rem,6vw,4.5rem);line-height:1.05;margin:18px 0;color:#fff}
#seo-static-content h2{font-size:1.65rem;margin:38px 0 12px;color:#fff}
#seo-static-content h3{font-size:1.15rem;margin:22px 0 8px;color:#fff}
#seo-static-content p,#seo-static-content li{font-size:1.05rem;line-height:1.75;color:#ddd7ea}
#seo-static-content a{color:#d7a8ff}
#seo-static-content section,#seo-static-content aside,#seo-static-content nav{border:1px solid #372a53;border-radius:16px;padding:22px;margin:24px 0;background:#120a25}
#seo-static-content .seo-static-brand{font-weight:800;letter-spacing:.04em}
#seo-static-content .seo-static-intro p{font-size:1.2rem}
#seo-static-content .seo-static-kicker{color:#c89cff;font-size:.78rem;font-weight:800;text-transform:uppercase;letter-spacing:.08em}
#seo-static-content ul,#seo-static-content ol{padding-left:24px}
</style>`;

for (const page of pages) {
  const canonical = absolute(page.path);
  let html = template;
  html = html.replace(/<html([^>]*)lang="[^"]*"([^>]*)>/i, `<html$1lang="${page.locale}"$2>`);
  html = replaceRequired(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`, "title");
  html = replaceRequired(html, /<meta name="description" content="[^"]*"\s*\/>/i, `<meta name="description" content="${escapeHtml(page.description)}" />`, "meta description");
  html = replaceRequired(html, /<link rel="canonical" href="[^"]*"\s*\/>/i, `<link rel="canonical" href="${canonical}" />`, "canonical");
  html = replaceRequired(html, /<meta property="og:title" content="[^"]*"\s*\/>/i, `<meta property="og:title" content="${escapeHtml(page.title)}" />`, "og:title");
  html = replaceRequired(html, /<meta property="og:description" content="[^"]*"\s*\/>/i, `<meta property="og:description" content="${escapeHtml(page.description)}" />`, "og:description");
  html = replaceRequired(html, /<meta property="og:url" content="[^"]*"\s*\/>/i, `<meta property="og:url" content="${canonical}" />`, "og:url");
  html = replaceRequired(html, /<meta name="twitter:title" content="[^"]*"\s*\/>/i, `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`, "twitter:title");
  html = replaceRequired(html, /<meta name="twitter:description" content="[^"]*"\s*\/>/i, `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`, "twitter:description");

  const headAddition = `${alternateLinks(page)}\n${staticStyle}\n<script id="seo-static-jsonld" type="application/ld+json">${safeJson(buildSchema(page))}</script>`;
  html = replaceRequired(html, /<\/head>/i, `${headAddition}\n</head>`, "head closing tag");
  html = replaceRequired(html, /<div id="root"><\/div>/i, `<div id="root">${renderStaticContent(page)}</div>`, "React root");
  html = `<!-- Generated by scripts/prerender-public-pages.mjs for ${page.path} -->\n${html}`;

  const destination = page.path === "/" ? resolve(distDir, "index.html") : resolve(distDir, page.path.slice(1), "index.html");
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, html, "utf8");
  console.log(`Pré-renderizado: ${page.path} -> ${destination.replace(`${root}/`, "")}`);
}

console.log(`Pré-renderização concluída para ${pages.length} rotas editoriais públicas.`);
