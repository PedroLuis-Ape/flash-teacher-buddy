import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadPublicLearningResources,
  publicLearningResourcePath,
} from "./public-learning-resource-data.mjs";

const SITE_URL = "https://www.apeeducation.org";
const root = process.cwd();
const distDir = resolve(root, "dist");
const templatePath = resolve(distDir, "index.html");
const sitemapPath = resolve(distDir, "sitemap.xml");
const redirectsPath = resolve(distDir, "_redirects");
const reportPath = resolve(distDir, "public-learning-resource-prerender-report.json");

export const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const safeJson = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");

function absolute(path) {
  return `${SITE_URL}${path}`;
}

function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Marcador ausente ao pré-renderizar material público: ${label}`);
  return source.replace(pattern, replacement);
}

function truncateDescription(value, fallback) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim() || fallback;
  return normalized.length <= 155 ? normalized : `${normalized.slice(0, 152).trimEnd()}…`;
}

function languageLabel(code) {
  const labels = {
    en: "Inglês",
    pt: "Português",
    es: "Espanhol",
    fr: "Francês",
    de: "Alemão",
    it: "Italiano",
    ja: "Japonês",
    ko: "Coreano",
    zh: "Chinês",
  };
  return labels[code] ?? code.toUpperCase();
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function resourceDescription(resource) {
  return truncateDescription(
    resource.description,
    `${resource.title}: material público de estudo com ${resource.list_count} listas e ${resource.card_count} cards no APE.`,
  );
}

function renderLists(resource) {
  const lists = resource.lists ?? [];
  if (!lists.length) {
    return `<section aria-labelledby="resource-lists"><h2 id="resource-lists">Conteúdo do material</h2><p>Esta coleção possui ${resource.list_count} listas e ${resource.card_count} cards públicos. Abra a versão interativa para estudar o conteúdo.</p><p><a class="resource-primary-link" href="${publicLearningResourcePath(resource.id)}">Abrir material no APE</a></p></section>`;
  }

  return `<section aria-labelledby="resource-lists"><h2 id="resource-lists">Listas públicas</h2><ol class="resource-list">${lists
    .map((list) => `<li><div><h3>${escapeHtml(list.title)}</h3>${list.description ? `<p>${escapeHtml(list.description)}</p>` : ""}<span>${list.card_count} cards</span></div><a href="/portal/list/${escapeHtml(list.id)}/games">Abrir atividades</a></li>`)
    .join("")}</ol></section>`;
}

export function buildLearningResourceJsonLd(resource) {
  const path = publicLearningResourcePath(resource.id);
  const canonical = absolute(path);
  const pageId = `${canonical}#page`;
  const learningResourceId = `${canonical}#learning-resource`;
  const contentsId = `${canonical}#contents`;
  const authorProfile = resource.author_slug
    ? absolute(`/portal/professor/${resource.author_slug}`)
    : null;
  const authorId = authorProfile ? `${authorProfile}#person` : `${canonical}#author`;
  const lists = resource.lists ?? [];
  const languages = Array.from(new Set([resource.lang_a || "en", resource.lang_b || "pt"]));
  const description = resourceDescription(resource);

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": pageId,
        url: canonical,
        name: resource.title,
        description,
        inLanguage: "pt-BR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        mainEntity: { "@id": learningResourceId },
        ...(lists.length ? { hasPart: { "@id": contentsId } } : {}),
        ...(resource.updated_at ? { dateModified: resource.updated_at } : {}),
      },
      {
        "@type": "LearningResource",
        "@id": learningResourceId,
        name: resource.title,
        description,
        url: canonical,
        inLanguage: languages,
        learningResourceType: resource.study_type === "language"
          ? ["Flashcards", "Language learning collection"]
          : ["Flashcards", "Study collection"],
        educationalUse: ["Practice", "Active recall", "Self study"],
        isAccessibleForFree: true,
        ...(resource.created_at ? { dateCreated: resource.created_at } : {}),
        ...(resource.updated_at ? { dateModified: resource.updated_at } : {}),
        author: { "@id": authorId },
        provider: { "@id": `${SITE_URL}/#organization` },
        mainEntityOfPage: { "@id": pageId },
        ...(lists.length ? { hasPart: lists.map((list) => ({ "@id": `${canonical}#list-${list.id}` })) } : {}),
      },
      {
        "@type": "Person",
        "@id": authorId,
        name: resource.author_display_name || "Professor no APE",
        jobTitle: "Professor",
        ...(authorProfile ? { url: authorProfile } : {}),
        ...(resource.author_avatar_url ? { image: resource.author_avatar_url } : {}),
        memberOf: { "@id": `${SITE_URL}/#organization` },
      },
      ...(lists.length ? [{
        "@type": "ItemList",
        "@id": contentsId,
        name: `Listas de ${resource.title}`,
        numberOfItems: lists.length,
        itemListElement: lists.map((list, index) => ({
          "@type": "ListItem",
          position: index + 1,
          item: {
            "@type": "LearningResource",
            "@id": `${canonical}#list-${list.id}`,
            name: list.title,
            ...(list.description ? { description: list.description } : {}),
            url: absolute(`/portal/list/${list.id}/games`),
            isPartOf: { "@id": learningResourceId },
          },
        })),
      }] : []),
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Portal público", item: absolute("/portal") },
          ...(authorProfile ? [{
            "@type": "ListItem",
            position: 2,
            name: resource.author_display_name || "Professor",
            item: authorProfile,
          }] : []),
          {
            "@type": "ListItem",
            position: authorProfile ? 3 : 2,
            name: resource.title,
            item: canonical,
          },
        ],
      },
    ],
  };
}

export function renderLearningResourceStaticContent(resource) {
  const authorPath = resource.author_slug ? `/portal/professor/${resource.author_slug}` : null;
  const updated = formatDate(resource.updated_at);
  const created = formatDate(resource.created_at);
  const description = resourceDescription(resource);

  return `<main id="seo-static-content" data-prerendered="true" data-public-learning-resource="${escapeHtml(resource.id)}"><article><p class="resource-static-brand"><a href="/portal">APE — Portal público</a></p><header><p class="resource-eyebrow">Material educacional público</p><h1>${escapeHtml(resource.title)}</h1><p class="resource-static-intro">${escapeHtml(description)}</p>${authorPath ? `<p class="resource-author">Criado por <a href="${escapeHtml(authorPath)}">${escapeHtml(resource.author_display_name)}</a></p>` : `<p class="resource-author">Publicado por ${escapeHtml(resource.author_display_name)}</p>`}</header><dl class="resource-static-counts"><div><dt>Listas</dt><dd>${resource.list_count}</dd></div><div><dt>Cards</dt><dd>${resource.card_count}</dd></div><div><dt>Idiomas</dt><dd>${escapeHtml(languageLabel(resource.lang_a))} + ${escapeHtml(languageLabel(resource.lang_b))}</dd></div></dl>${updated || created ? `<p class="resource-date">${updated ? `Atualizado em <time datetime="${escapeHtml(resource.updated_at)}">${updated}</time>` : `Publicado em <time datetime="${escapeHtml(resource.created_at)}">${created}</time>`}</p>` : ""}${renderLists(resource)}<nav aria-label="Navegação pública"><a href="${publicLearningResourcePath(resource.id)}">Estudar este material</a>${authorPath ? `<a href="${escapeHtml(authorPath)}">Ver perfil do professor</a>` : ""}<a href="/pt-br/fonte-oficial">Sobre o APE</a></nav></article></main>`;
}

const resourceStyle = `<style id="public-learning-resource-static-style">#seo-static-content{min-height:100vh;background:#09001f;color:#f8f7ff;padding:42px 20px;font-family:Nunito,system-ui,sans-serif}#seo-static-content article{max-width:920px;margin:0 auto}#seo-static-content a{color:#d7a8ff}#seo-static-content h1{font-size:clamp(2.1rem,6vw,4rem);line-height:1.05;margin:.4rem 0}#seo-static-content h2{font-size:1.55rem;margin:2.25rem 0 .85rem}#seo-static-content h3{font-size:1.1rem;margin:0}#seo-static-content p,#seo-static-content li,#seo-static-content dt,#seo-static-content dd{line-height:1.65;color:#d8d3e6}.resource-static-brand{font-weight:800}.resource-eyebrow{font-size:.82rem;text-transform:uppercase;letter-spacing:.14em;color:#c593ff!important;font-weight:800}.resource-static-intro{font-size:1.15rem;max-width:760px}.resource-author,.resource-date{font-size:.95rem}.resource-static-counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem;margin:1.5rem 0}.resource-static-counts div,.resource-list li{border:1px solid #392653;background:#16072c;border-radius:12px;padding:1rem}.resource-static-counts dt{font-size:.85rem}.resource-static-counts dd{font-size:1.25rem;font-weight:800;margin:0;color:#fff}.resource-list{display:grid;gap:.75rem;padding:0;list-style-position:inside}.resource-list li{display:flex;justify-content:space-between;gap:1rem;align-items:center}.resource-list p{margin:.35rem 0}.resource-list span{font-size:.9rem}.resource-primary-link,#seo-static-content nav a{display:inline-block;border:1px solid #6f3ca0;border-radius:999px;padding:.55rem .9rem;text-decoration:none}#seo-static-content nav{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:2rem}@media(max-width:620px){.resource-static-counts{grid-template-columns:1fr}.resource-list li{align-items:flex-start;flex-direction:column}}</style>`;

export function renderLearningResourceHtml(template, resource) {
  const path = publicLearningResourcePath(resource.id);
  const canonical = absolute(path);
  const title = `${resource.title} | Material público no APE`;
  const description = resourceDescription(resource);
  const image = resource.author_avatar_url || `${SITE_URL}/branding/icon.png`;
  let html = template;

  html = replaceRequired(html, /<html\s+lang="[^"]+"/i, '<html lang="pt-BR"', "html lang");
  html = replaceRequired(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`, "title");
  html = replaceRequired(html, /<meta name="description" content="[^"]*"\s*\/>/i, `<meta name="description" content="${escapeHtml(description)}" />`, "description");
  html = replaceRequired(html, /<link rel="canonical" href="[^"]*"\s*\/>/i, `<link rel="canonical" href="${canonical}" />`, "canonical");
  html = replaceRequired(html, /<meta property="og:title" content="[^"]*"\s*\/>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`, "og:title");
  html = replaceRequired(html, /<meta property="og:description" content="[^"]*"\s*\/>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`, "og:description");
  html = replaceRequired(html, /<meta property="og:url" content="[^"]*"\s*\/>/i, `<meta property="og:url" content="${canonical}" />`, "og:url");
  html = replaceRequired(html, /<meta property="og:image" content="[^"]*"\s*\/>/i, `<meta property="og:image" content="${escapeHtml(image)}" />`, "og:image");
  html = replaceRequired(html, /<meta property="og:image:alt" content="[^"]*"\s*\/>/i, `<meta property="og:image:alt" content="Identidade visual do material ${escapeHtml(resource.title)}" />`, "og:image:alt");
  html = replaceRequired(html, /<meta name="twitter:title" content="[^"]*"\s*\/>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`, "twitter:title");
  html = replaceRequired(html, /<meta name="twitter:description" content="[^"]*"\s*\/>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`, "twitter:description");
  html = replaceRequired(html, /<meta name="twitter:image" content="[^"]*"\s*\/>/i, `<meta name="twitter:image" content="${escapeHtml(image)}" />`, "twitter:image");
  html = replaceRequired(html, /<\/head>/i, `${resourceStyle}\n<script id="public-learning-resource-jsonld" type="application/ld+json">${safeJson(buildLearningResourceJsonLd(resource))}</script>\n</head>`, "head");
  html = replaceRequired(html, /<div id="root"><\/div>/i, `<div id="root">${renderLearningResourceStaticContent(resource)}</div>`, "root");
  return `<!-- Generated by scripts/prerender-public-learning-resources.mjs for ${path} -->\n${html}`;
}

export function appendLearningResourceUrlsToSitemap(sitemap, resources, fallbackDate) {
  if (!resources.length) return sitemap;
  const entries = resources
    .filter((resource) => !sitemap.includes(`<loc>${absolute(publicLearningResourcePath(resource.id))}</loc>`))
    .map((resource) => {
      const lastmod = resource.updated_at?.slice(0, 10) || fallbackDate;
      return `  <url><loc>${absolute(publicLearningResourcePath(resource.id))}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`;
    })
    .join("\n");
  return entries ? sitemap.replace(/\s*<\/urlset>\s*$/i, `\n${entries}\n</urlset>\n`) : sitemap;
}

export function injectLearningResourceRedirects(redirects, resources) {
  if (!resources.length) return redirects;
  const marker = "/*                          /index.html                       200";
  if (!redirects.includes(marker)) throw new Error("Fallback principal não encontrado em dist/_redirects.");
  const dynamicLines = resources
    .map((resource) => {
      const path = publicLearningResourcePath(resource.id);
      return `${path.padEnd(50)} ${`${path}/index.html`.padEnd(62)} 200`;
    })
    .filter((line) => !redirects.includes(line.trim().split(/\s+/)[0]))
    .join("\n");
  return dynamicLines ? redirects.replace(marker, `${dynamicLines}\n${marker}`) : redirects;
}

export async function prerenderPublicLearningResources() {
  if (!existsSync(templatePath)) throw new Error("dist/index.html não encontrado.");
  if (!existsSync(sitemapPath)) throw new Error("dist/sitemap.xml não encontrado.");
  if (!existsSync(redirectsPath)) throw new Error("dist/_redirects não encontrado.");

  const template = readFileSync(templatePath, "utf8");
  const discovery = await loadPublicLearningResources();
  const resources = discovery.resources ?? [];
  const generatedAt = new Date().toISOString();
  const fallbackDate = generatedAt.slice(0, 10);
  const generatedPaths = [];

  for (const resource of resources) {
    const path = publicLearningResourcePath(resource.id);
    const destination = resolve(distDir, path.slice(1), "index.html");
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, renderLearningResourceHtml(template, resource), "utf8");
    generatedPaths.push(path);
  }

  writeFileSync(
    sitemapPath,
    appendLearningResourceUrlsToSitemap(readFileSync(sitemapPath, "utf8"), resources, fallbackDate),
    "utf8",
  );
  writeFileSync(
    redirectsPath,
    injectLearningResourceRedirects(readFileSync(redirectsPath, "utf8"), resources),
    "utf8",
  );

  const report = {
    generatedAt,
    runtimeSource: discovery.runtimeSource,
    discoveryMode: discovery.discoveryMode,
    resourceCount: resources.length,
    listCount: resources.reduce((sum, resource) => sum + (resource.lists?.length ?? 0), 0),
    generatedPaths,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Pré-render público de materiais: ${resources.length} recursos (${discovery.discoveryMode}).`);
  return report;
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectExecution) {
  prerenderPublicLearningResources().catch((error) => {
    console.error("Falha na pré-renderização de materiais públicos:", error);
    process.exit(1);
  });
}
