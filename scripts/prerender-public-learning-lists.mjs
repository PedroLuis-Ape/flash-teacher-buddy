import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadPublicLearningLists,
  publicLearningListPath,
} from "./public-learning-list-data.mjs";

const SITE_URL = "https://www.apeeducation.org";
const root = process.cwd();
const distDir = resolve(root, "dist");
const templatePath = resolve(distDir, "index.html");
const sitemapPath = resolve(distDir, "sitemap.xml");
const redirectsPath = resolve(distDir, "_redirects");
const reportPath = resolve(distDir, "public-learning-list-prerender-report.json");

export const escapeHtml = (value) => String(value ?? "")
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&#39;");

const safeJson = (value) => JSON.stringify(value).replaceAll("<", "\\u003c");
const absolute = (path) => `${SITE_URL}${path}`;

function replaceRequired(source, pattern, replacement, label) {
  if (!pattern.test(source)) throw new Error(`Marcador ausente ao pré-renderizar lista pública: ${label}`);
  return source.replace(pattern, replacement);
}

function truncateDescription(value, fallback) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim() || fallback;
  return normalized.length <= 155 ? normalized : `${normalized.slice(0, 152).trimEnd()}…`;
}

function listDescription(list) {
  return truncateDescription(
    list.description,
    `${list.title}: lista pública de estudo com ${list.card_count} cards no APE.`,
  );
}

function languageLabel(code) {
  const labels = { en: "Inglês", pt: "Português", es: "Espanhol", fr: "Francês", de: "Alemão", it: "Italiano", ja: "Japonês", ko: "Coreano", zh: "Chinês" };
  return labels[code] ?? String(code ?? "Idioma").toUpperCase();
}

function formatDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

export function buildPublicLearningListJsonLd(list) {
  const canonical = absolute(publicLearningListPath(list.id));
  const folderUrl = absolute(`/portal/folder/${list.folder_id}`);
  const authorUrl = list.author_slug ? absolute(`/portal/professor/${list.author_slug}`) : null;
  const pageId = `${canonical}#page`;
  const resourceId = `${canonical}#learning-resource`;
  const authorId = authorUrl ? `${authorUrl}#person` : `${canonical}#author`;
  const previewId = `${canonical}#card-preview`;
  const cards = list.cards ?? [];
  const description = listDescription(list);
  const languages = Array.from(new Set([list.lang_a || "en", list.lang_b || "pt"]));

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": pageId,
        url: canonical,
        name: list.title,
        description,
        inLanguage: "pt-BR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        mainEntity: { "@id": resourceId },
        ...(list.updated_at ? { dateModified: list.updated_at } : {}),
      },
      {
        "@type": "LearningResource",
        "@id": resourceId,
        url: canonical,
        name: list.title,
        description,
        inLanguage: languages,
        learningResourceType: list.study_type === "language" ? ["Flashcards", "Language learning list"] : ["Flashcards", "Study list"],
        educationalUse: ["Practice", "Active recall", "Self study"],
        isAccessibleForFree: true,
        author: { "@id": authorId },
        provider: { "@id": `${SITE_URL}/#organization` },
        isPartOf: { "@type": "LearningResource", "@id": `${folderUrl}#learning-resource`, url: folderUrl, name: list.folder_title || "Material público" },
        mainEntityOfPage: { "@id": pageId },
        ...(list.created_at ? { dateCreated: list.created_at } : {}),
        ...(list.updated_at ? { dateModified: list.updated_at } : {}),
        ...(cards.length ? { hasPart: { "@id": previewId } } : {}),
      },
      {
        "@type": "Person",
        "@id": authorId,
        name: list.author_display_name || "Professor no APE",
        jobTitle: "Professor",
        ...(authorUrl ? { url: authorUrl } : {}),
        ...(list.author_avatar_url ? { image: list.author_avatar_url } : {}),
        memberOf: { "@id": `${SITE_URL}/#organization` },
      },
      ...(cards.length ? [{
        "@type": "ItemList",
        "@id": previewId,
        name: `Prévia de ${list.title}`,
        numberOfItems: cards.length,
        itemListElement: cards.map((card, index) => ({ "@type": "ListItem", position: index + 1, name: card.term, description: card.translation })),
      }] : []),
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Portal público", item: absolute("/portal") },
          ...(authorUrl ? [{ "@type": "ListItem", position: 2, name: list.author_display_name || "Professor", item: authorUrl }] : []),
          { "@type": "ListItem", position: authorUrl ? 3 : 2, name: list.folder_title || "Material público", item: folderUrl },
          { "@type": "ListItem", position: authorUrl ? 4 : 3, name: list.title, item: canonical },
        ],
      },
    ],
  };
}

function renderCards(list) {
  const cards = list.cards ?? [];
  if (!cards.length) return `<section aria-labelledby="list-preview"><h2 id="list-preview">Prévia dos cards</h2><p>Esta lista está publicada, mas não possui cards principais disponíveis para prévia.</p></section>`;
  return `<section aria-labelledby="list-preview"><h2 id="list-preview">Prévia dos cards</h2><p>Até 24 cards principais são mostrados nesta página. Camadas internas não inflam a contagem.</p><ol class="list-card-preview">${cards.map((card, index) => `<li><span>Card ${index + 1}</span><strong>${escapeHtml(card.term)}</strong><p>${escapeHtml(card.translation)}</p></li>`).join("")}</ol></section>`;
}

export function renderPublicLearningListStaticContent(list) {
  const authorPath = list.author_slug ? `/portal/professor/${list.author_slug}` : null;
  const folderPath = `/portal/folder/${list.folder_id}`;
  const updated = formatDate(list.updated_at);
  const created = formatDate(list.created_at);
  const description = listDescription(list);
  return `<main id="seo-static-content" data-prerendered="true" data-public-learning-list="${escapeHtml(list.id)}"><article><p class="list-static-brand"><a href="/portal">APE — Portal público</a></p><p><a href="${folderPath}">← Voltar para ${escapeHtml(list.folder_title || "o material")}</a></p><header><p class="list-eyebrow">Lista educacional pública</p><h1>${escapeHtml(list.title)}</h1><p class="list-static-intro">${escapeHtml(description)}</p>${authorPath ? `<p>Criada por <a href="${authorPath}">${escapeHtml(list.author_display_name)}</a></p>` : `<p>Publicada por ${escapeHtml(list.author_display_name)}</p>`}</header><dl class="list-static-facts"><div><dt>Cards</dt><dd>${list.card_count}</dd></div><div><dt>Idiomas</dt><dd>${escapeHtml(languageLabel(list.lang_a))} + ${escapeHtml(languageLabel(list.lang_b))}</dd></div><div><dt>Pasta</dt><dd><a href="${folderPath}">${escapeHtml(list.folder_title || "Material público")}</a></dd></div></dl>${updated || created ? `<p class="list-date">${updated ? `Atualizada em <time datetime="${escapeHtml(list.updated_at)}">${updated}</time>` : `Publicada em <time datetime="${escapeHtml(list.created_at)}">${created}</time>`}</p>` : ""}<nav class="list-actions" aria-label="Modos de estudo"><a href="/portal/list/${list.id}/games">Abrir atividades</a><a href="/portal/list/${list.id}/study">Estudar flashcards</a><a href="/portal/list/${list.id}/mixed-study">Modo misto</a></nav>${renderCards(list)}<nav aria-label="Navegação pública"><a href="${folderPath}">Ver pasta de origem</a>${authorPath ? `<a href="${authorPath}">Ver professor</a>` : ""}<a href="/pt-br/metodologia">Entender a metodologia</a></nav></article></main>`;
}

const style = `<style id="public-learning-list-static-style">#seo-static-content{min-height:100vh;background:#09001f;color:#f8f7ff;padding:42px 20px;font-family:Nunito,system-ui,sans-serif}#seo-static-content article{max-width:940px;margin:0 auto}#seo-static-content a{color:#d7a8ff}#seo-static-content h1{font-size:clamp(2.1rem,6vw,4rem);line-height:1.05;margin:.4rem 0}#seo-static-content h2{font-size:1.55rem;margin:2.25rem 0 .85rem}#seo-static-content p,#seo-static-content li,#seo-static-content dt,#seo-static-content dd{line-height:1.65;color:#d8d3e6}.list-static-brand{font-weight:800}.list-eyebrow{font-size:.82rem;text-transform:uppercase;letter-spacing:.14em;color:#c593ff!important;font-weight:800}.list-static-intro{font-size:1.15rem;max-width:760px}.list-static-facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem;margin:1.5rem 0}.list-static-facts div,.list-card-preview li{border:1px solid #392653;background:#16072c;border-radius:12px;padding:1rem}.list-static-facts dt{font-size:.85rem}.list-static-facts dd{font-size:1.05rem;font-weight:800;margin:0;color:#fff}.list-card-preview{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem;padding:0;list-style:none}.list-card-preview span{display:block;color:#c593ff;font-size:.75rem;font-weight:800;text-transform:uppercase}.list-card-preview strong{display:block;margin-top:.5rem;font-size:1.05rem}.list-card-preview p{margin:.35rem 0 0}.list-actions,#seo-static-content article>nav{display:flex;flex-wrap:wrap;gap:.75rem;margin-top:1.5rem}.list-actions a,#seo-static-content article>nav a{display:inline-block;border:1px solid #6f3ca0;border-radius:999px;padding:.55rem .9rem;text-decoration:none}@media(max-width:650px){.list-static-facts,.list-card-preview{grid-template-columns:1fr}}</style>`;

export function renderPublicLearningListHtml(template, list) {
  const path = publicLearningListPath(list.id);
  const canonical = absolute(path);
  const title = `${list.title} | Lista pública no APE`;
  const description = listDescription(list);
  const image = list.author_avatar_url || `${SITE_URL}/branding/icon.png`;
  let html = template;
  html = replaceRequired(html, /<html\s+lang="[^"]+"/i, '<html lang="pt-BR"', "html lang");
  html = replaceRequired(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`, "title");
  html = replaceRequired(html, /<meta name="description" content="[^"]*"\s*\/>/i, `<meta name="description" content="${escapeHtml(description)}" />`, "description");
  html = replaceRequired(html, /<link rel="canonical" href="[^"]*"\s*\/>/i, `<link rel="canonical" href="${canonical}" />`, "canonical");
  html = replaceRequired(html, /<meta property="og:title" content="[^"]*"\s*\/>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`, "og:title");
  html = replaceRequired(html, /<meta property="og:description" content="[^"]*"\s*\/>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`, "og:description");
  html = replaceRequired(html, /<meta property="og:url" content="[^"]*"\s*\/>/i, `<meta property="og:url" content="${canonical}" />`, "og:url");
  html = replaceRequired(html, /<meta property="og:image" content="[^"]*"\s*\/>/i, `<meta property="og:image" content="${escapeHtml(image)}" />`, "og:image");
  html = replaceRequired(html, /<meta name="twitter:title" content="[^"]*"\s*\/>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`, "twitter:title");
  html = replaceRequired(html, /<meta name="twitter:description" content="[^"]*"\s*\/>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`, "twitter:description");
  html = replaceRequired(html, /<meta name="twitter:image" content="[^"]*"\s*\/>/i, `<meta name="twitter:image" content="${escapeHtml(image)}" />`, "twitter:image");
  html = replaceRequired(html, /<\/head>/i, `${style}\n<script id="public-learning-list-jsonld" type="application/ld+json">${safeJson(buildPublicLearningListJsonLd(list))}</script>\n</head>`, "head");
  html = replaceRequired(html, /<div id="root"><\/div>/i, `<div id="root">${renderPublicLearningListStaticContent(list)}</div>`, "root");
  return `<!-- Generated by scripts/prerender-public-learning-lists.mjs for ${path} -->\n${html}`;
}

export function appendPublicLearningListUrlsToSitemap(sitemap, lists, generatedAt) {
  const entries = lists
    .filter((list) => !sitemap.includes(`<loc>${absolute(publicLearningListPath(list.id))}</loc>`))
    .map((list) => {
      const lastmod = (list.updated_at || list.created_at || generatedAt).slice(0, 10);
      return `  <url><loc>${absolute(publicLearningListPath(list.id))}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`;
    })
    .join("\n");
  return entries ? sitemap.replace(/\s*<\/urlset>\s*$/i, `\n${entries}\n</urlset>\n`) : sitemap;
}

export function injectPublicLearningListRedirects(redirects, lists) {
  const marker = "/*                          /index.html                       200";
  if (!redirects.includes(marker)) throw new Error("Fallback principal não encontrado em dist/_redirects.");
  const lines = lists
    .map((list) => {
      const path = publicLearningListPath(list.id);
      return `${path.padEnd(44)} ${`${path}/index.html`.padEnd(54)} 200`;
    })
    .filter((line) => !redirects.includes(line.trim().split(/\s+/)[0]))
    .join("\n");
  return lines ? redirects.replace(marker, `${lines}\n${marker}`) : redirects;
}

export async function prerenderPublicLearningLists() {
  if (!existsSync(templatePath) || !existsSync(sitemapPath) || !existsSync(redirectsPath)) throw new Error("Arquivos de build obrigatórios ausentes.");
  const template = readFileSync(templatePath, "utf8");
  const directory = await loadPublicLearningLists();
  const lists = directory.lists ?? [];
  const generatedAt = new Date().toISOString();
  const generatedPaths = [];

  for (const list of lists) {
    const path = publicLearningListPath(list.id);
    const destination = resolve(distDir, path.slice(1), "index.html");
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, renderPublicLearningListHtml(template, list), "utf8");
    generatedPaths.push(path);
  }

  writeFileSync(sitemapPath, appendPublicLearningListUrlsToSitemap(readFileSync(sitemapPath, "utf8"), lists, generatedAt), "utf8");
  writeFileSync(redirectsPath, injectPublicLearningListRedirects(readFileSync(redirectsPath, "utf8"), lists), "utf8");
  const report = { generatedAt, runtimeSource: directory.runtimeSource, discoveryMode: directory.discoveryMode, listCount: lists.length, previewCardCount: lists.reduce((sum, list) => sum + (list.cards?.length ?? 0), 0), generatedPaths };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Pré-render público de listas: ${lists.length} páginas (${directory.discoveryMode}).`);
  return report;
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectExecution) prerenderPublicLearningLists().catch((error) => { console.error("Falha na pré-renderização de listas públicas:", error); process.exit(1); });
