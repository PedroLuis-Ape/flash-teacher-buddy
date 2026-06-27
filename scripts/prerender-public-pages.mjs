import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const distDir = resolve(root, "dist");
const templatePath = resolve(distDir, "index.html");
const pagesPath = resolve(root, "config/public-seo-pages.json");
const siteUrl = "https://www.apeeducation.org";
const organizationId = `${siteUrl}/#organization`;
const websiteId = `${siteUrl}/#website`;
const appId = `${siteUrl}/#app`;
const pageSchemaTypes = new Set(["WebPage", "CollectionPage", "AboutPage"]);

if (!existsSync(templatePath)) {
  console.error("ERRO: dist/index.html não encontrado. Execute o build do Vite primeiro.");
  process.exit(1);
}

const template = readFileSync(templatePath, "utf8");
const pages = JSON.parse(readFileSync(pagesPath, "utf8"));

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

function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) {
    throw new Error(`Marcador obrigatório não encontrado em index.html: ${label}`);
  }
  return source.replace(pattern, replacement);
}

function renderSection(section) {
  const paragraphs = (section.paragraphs ?? [])
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("\n");
  const items = section.items?.length
    ? `<ul>${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";

  return `<section><h2>${escapeHtml(section.heading)}</h2>${paragraphs}${items}</section>`;
}

function renderStaticContent(page) {
  const sections = page.sections.map(renderSection).join("\n");
  const links = page.links?.length
    ? `<nav aria-label="Conteúdo relacionado"><h2>Explore também</h2><ul>${page.links
        .map((link) => `<li><a href="${escapeHtml(link.href)}">${escapeHtml(link.label)}</a></li>`)
        .join("")}</ul></nav>`
    : "";

  return `<main id="seo-static-content" data-prerendered="true">
  <article>
    <p class="seo-static-brand"><a href="/">APE — App Piteco</a></p>
    <h1>${escapeHtml(page.h1)}</h1>
    <p class="seo-static-intro">${escapeHtml(page.intro)}</p>
    ${sections}
    ${links}
  </article>
</main>`;
}

function buildOrganization() {
  return {
    "@type": "Organization",
    "@id": organizationId,
    name: "APE Education",
    alternateName: ["APE", "App Piteco"],
    url: `${siteUrl}/`,
    logo: {
      "@type": "ImageObject",
      url: `${siteUrl}/branding/icon.png`,
    },
    description:
      "Plataforma educacional brasileira de flashcards, estudo ativo e organização de materiais para alunos e professores.",
  };
}

function buildWebsite() {
  return {
    "@type": "WebSite",
    "@id": websiteId,
    name: "APE — Apprentice Practice & Enhancement",
    alternateName: "App Piteco",
    url: `${siteUrl}/`,
    inLanguage: "pt-BR",
    publisher: { "@id": organizationId },
  };
}

function buildApplication() {
  return {
    "@type": "SoftwareApplication",
    "@id": appId,
    name: "APE — App Piteco",
    alternateName: "Apprentice Practice & Enhancement",
    applicationCategory: "EducationalApplication",
    operatingSystem: "Web",
    inLanguage: "pt-BR",
    description:
      "Aplicativo educacional de flashcards, jogos, prática ativa e organização de materiais para alunos e professores.",
    url: `${siteUrl}/`,
    publisher: { "@id": organizationId },
  };
}

function buildBreadcrumb(page, canonical) {
  if (page.path === "/") return null;

  return {
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumb`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Início",
        item: `${siteUrl}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: page.h1,
        item: canonical,
      },
    ],
  };
}

function buildSchema(page, canonical) {
  const pageId = `${canonical}#webpage`;
  const graph = [buildOrganization(), buildWebsite(), buildApplication()];
  const breadcrumb = buildBreadcrumb(page, canonical);
  const mainEntity = [];

  if (breadcrumb) graph.push(breadcrumb);

  if (page.path === "/") {
    mainEntity.push({ "@id": appId });
  }

  if (!pageSchemaTypes.has(page.schemaType)) {
    const learningResourceId = `${canonical}#learning-resource`;
    const learningResource = {
      "@type": page.schemaType,
      "@id": learningResourceId,
      name: page.h1,
      description: page.description,
      url: canonical,
      inLanguage: "pt-BR",
      mainEntityOfPage: { "@id": pageId },
      provider: { "@id": organizationId },
      ...(page.educationalLevel ? { educationalLevel: page.educationalLevel } : {}),
    };
    graph.push(learningResource);
    mainEntity.push({ "@id": learningResourceId });
  }

  graph.push({
    "@type": pageSchemaTypes.has(page.schemaType) ? page.schemaType : "WebPage",
    "@id": pageId,
    name: page.h1,
    headline: page.title,
    description: page.description,
    url: canonical,
    inLanguage: "pt-BR",
    isPartOf: { "@id": websiteId },
    about: { "@id": appId },
    publisher: { "@id": organizationId },
    ...(breadcrumb ? { breadcrumb: { "@id": breadcrumb["@id"] } } : {}),
    ...(mainEntity.length > 0 ? { mainEntity } : {}),
  });

  return {
    "@context": "https://schema.org",
    "@graph": graph,
  };
}

const staticStyle = `<style id="seo-static-style">
#seo-static-content{min-height:100vh;background:#09001f;color:#f8f7ff;padding:48px 20px;font-family:Nunito,system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
#seo-static-content article{max-width:850px;margin:0 auto}
#seo-static-content h1{font-size:clamp(2rem,6vw,4rem);line-height:1.05;margin:18px 0}
#seo-static-content h2{font-size:1.5rem;margin:34px 0 10px}
#seo-static-content p,#seo-static-content li{font-size:1.05rem;line-height:1.7;color:#d8d3e6}
#seo-static-content a{color:#d7a8ff}
#seo-static-content .seo-static-brand{font-weight:800;letter-spacing:.04em}
#seo-static-content .seo-static-intro{font-size:1.2rem}
#seo-static-content ul{padding-left:24px}
</style>`;

for (const page of pages) {
  const canonical = `${siteUrl}${page.path === "/" ? "/" : page.path}`;
  let html = template;

  html = replaceRequired(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(page.title)}</title>`, "title");
  html = replaceRequired(
    html,
    /<meta name="description" content="[^"]*"\s*\/>/i,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    "meta description",
  );
  html = replaceRequired(
    html,
    /<link rel="canonical" href="[^"]*"\s*\/>/i,
    `<link rel="canonical" href="${canonical}" />`,
    "canonical",
  );
  html = replaceRequired(
    html,
    /<meta property="og:title" content="[^"]*"\s*\/>/i,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    "og:title",
  );
  html = replaceRequired(
    html,
    /<meta property="og:description" content="[^"]*"\s*\/>/i,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    "og:description",
  );
  html = replaceRequired(
    html,
    /<meta property="og:url" content="[^"]*"\s*\/>/i,
    `<meta property="og:url" content="${canonical}" />`,
    "og:url",
  );
  html = replaceRequired(
    html,
    /<meta name="twitter:title" content="[^"]*"\s*\/>/i,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    "twitter:title",
  );
  html = replaceRequired(
    html,
    /<meta name="twitter:description" content="[^"]*"\s*\/>/i,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    "twitter:description",
  );

  const pageSchema = buildSchema(page, canonical);
  const headAddition = `${staticStyle}\n<script id="seo-static-jsonld" type="application/ld+json">${safeJson(pageSchema)}</script>`;
  html = replaceRequired(html, /<\/head>/i, `${headAddition}\n</head>`, "head closing tag");
  html = replaceRequired(
    html,
    /<div id="root"><\/div>/i,
    `<div id="root">${renderStaticContent(page)}</div>`,
    "React root",
  );
  html = `<!-- Generated by scripts/prerender-public-pages.mjs for ${page.path} -->\n${html}`;

  const destination = page.path === "/"
    ? resolve(distDir, "index.html")
    : resolve(distDir, page.path.slice(1), "index.html");
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, html, "utf8");
  console.log(`Pré-renderizado: ${page.path} -> ${destination.replace(`${root}/`, "")}`);
}

console.log(`Pré-renderização concluída para ${pages.length} rotas públicas.`);
