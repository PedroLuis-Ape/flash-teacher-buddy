/**
 * Pre-renderiza as paginas canonicas de material publico curado.
 *
 * Gera HTML inicial (crawlable sem JS), canonical unico e o sitemap dedicado.
 * Falha alto se algum HTML gerado nao tiver H1, canonical correto ou CTA.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadPublicMaterials,
  localeUrlSegment,
  publicCatalogPath,
  publicMaterialPath,
} from "./public-material-data.mjs";

const SITE_URL = "https://www.apeeducation.org";

/** Mesma politica emitida em runtime por src/components/seo/SEOHead.tsx. */
export const DEFAULT_ROBOTS =
  "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1";

const CATALOG_COPY = {
  "pt-BR": {
    title: "Materiais para estudar inglês",
    intro: "Materiais públicos curados para praticar inglês no APE. {total} materiais disponíveis.",
    empty: "Ainda não há materiais publicados neste idioma.",
  },
  en: {
    title: "Study materials",
    intro: "Curated public materials to practise English on APE. {total} materials available.",
    empty: "Ainda não há materiais publicados neste idioma.",
  },
  es: {
    title: "Materiales para estudiar inglés",
    intro: "Materiales públicos curados para practicar inglés en APE. {total} materiales disponibles.",
    empty: "Ainda não há materiais publicados neste idioma.",
  },
  fr: {
    title: "Supports pour étudier l'anglais",
    intro: "Supports publics vérifiés pour pratiquer l'anglais sur APE. {total} supports disponibles.",
    empty: "Ainda não há materiais publicados neste idioma.",
  },
  it: {
    title: "Materiali per studiare inglese",
    intro: "Materiali pubblici curati per esercitare l'inglese su APE. {total} materiali disponibili.",
    empty: "Ainda não há materiais publicados neste idioma.",
  },
};

export function catalogCopy(locale) {
  return CATALOG_COPY[locale] ?? CATALOG_COPY["pt-BR"];
}

const root = process.cwd();
const distDir = resolve(root, "dist");
const templatePath = resolve(distDir, "index.html");
const sitemapPath = resolve(distDir, "sitemap-materials.xml");
const reportPath = resolve(distDir, "public-material-prerender-report.json");

export const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const absolute = (path) => `${SITE_URL}${path}`;

function truncate(value, fallback) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim() || fallback;
  return normalized.length <= 155 ? normalized : `${normalized.slice(0, 152).trimEnd()}…`;
}

export function renderMaterialStaticContent(material) {
  const list = material.list;
  const editorial = material.editorial ?? {};
  const meta = [editorial.level, editorial.theme].filter(Boolean).join(" · ");
  const samples = (material.samples ?? []).slice(0, 8);
  const sampleItems = samples
    .map((sample) => `<li><strong>${escapeHtml(sample.term)}</strong> <span aria-hidden="true">→</span> <span>${escapeHtml(sample.translation)}</span></li>`)
    .join("");
  return `<main id="seo-static-content" data-prerendered="true" data-public-material="${escapeHtml(material.slug)}"><article><p><a href="/portal">APE — Portal público</a></p><header>${meta ? `<p>${escapeHtml(meta)}</p>` : ""}<h1>${escapeHtml(list.title)}</h1>${list.folder_title ? `<p>${escapeHtml(list.folder_title)}</p>` : ""}<p>${escapeHtml(truncate(editorial.summary, `Material público com ${list.card_count} cards no APE.`))}</p></header><dl><div><dt>Cards</dt><dd>${list.card_count}</dd></div><div><dt>Autor</dt><dd>${escapeHtml(list.author_name)}</dd></div>${editorial.resource_type ? `<div><dt>Tipo</dt><dd>${escapeHtml(editorial.resource_type)}</dd></div>` : ""}</dl><nav aria-label="Ações"><a href="${escapeHtml(material.play_path ?? "/portal")}">Jogar agora</a><a href="/portal">Explorar materiais</a></nav>${samples.length ? `<section><h2>Amostra de cards</h2><ul>${sampleItems}</ul></section>` : ""}</article></main>`;
}

export function renderCatalogStaticContent({ locale, items = [], total = 0 }) {
  const copy = catalogCopy(locale);
  const segment = localeUrlSegment(locale);
  const intro = copy.intro.replace("{total}", String(Number.isFinite(Number(total)) ? Number(total) : items.length));
  const list = items.length
    ? `<ul data-catalog-items>${items
        .map((item) => {
          const meta = [item.level, item.theme].filter(Boolean).map(escapeHtml).join(" · ");
          const cards = item.card_count ? `${item.card_count} cards` : "";
          const author = item.author_name ? escapeHtml(item.author_name) : "";
          const details = [meta, cards, author].filter(Boolean).join(" · ");
          const summary = item.summary ? `<p>${escapeHtml(item.summary)}</p>` : "";
          return `<li><h2><a href="${escapeHtml(item.canonical_path ?? "/portal")}">${escapeHtml(item.title)}</a></h2>${summary}${details ? `<p>${details}</p>` : ""}<a href="${escapeHtml(item.play_path ?? "/portal")}">Jogar agora</a></li>`;
        })
        .join("")}</ul>`
    : `<p>${escapeHtml(copy.empty)}</p>`;
  return `<main id="seo-static-content" data-prerendered="true" data-public-catalog="${segment}"><article><p><a href="/portal">APE — Portal público</a></p><header><h1>${escapeHtml(copy.title)}</h1><p>${escapeHtml(intro)}</p></header>${list}</article></main>`;
}

export function applyHead(html, { title, description, canonical, robots = DEFAULT_ROBOTS }) {
  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  if (/<meta name="description"[^>]*>/i.test(out)) {
    out = out.replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(description)}">`);
  } else {
    out = out.replace("</head>", `  <meta name="description" content="${escapeHtml(description)}">\n</head>`);
  }
  // O shell carrega um canonical proprio: remover antes de inserir o correto.
  out = out.replace(/\s*<link rel="canonical"[^>]*>/gi, "");
  // O shell tambem carrega um meta robots proprio. Sem remove-lo, a pagina
  // prerenderizada sai com duas politicas de robots conflitantes.
  out = out.replace(/\s*<meta name="robots"[^>]*>/gi, "");
  out = out.replace(/<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${canonical}">`);
  out = out.replace(
    "</head>",
    `  <link rel="canonical" href="${canonical}">\n  <meta name="robots" content="${escapeHtml(robots)}">\n</head>`,
  );
  return out;
}

/**
 * Dados estruturados do material curado.
 *
 * Fonte unica: o JSON-LD vive no HTML pre-renderizado, porque crawlers de
 * assistentes (OAI-SearchBot e afins) nao executam JavaScript. Emiti-lo tambem
 * no SPA geraria dois blocos identicos na mesma pagina.
 *
 * Regra: so entra o que existe no payload e, portanto, no HTML visivel.
 */
function jsonLdText(value) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

function jsonLdLanguage(value) {
  const normalized = jsonLdText(value)?.toLowerCase();
  return normalized && /^[a-z]{2,3}(?:-[a-z]{2,4})?$/.test(normalized) ? normalized : undefined;
}

function compactNodes(values) {
  return values.filter(Boolean);
}

export function buildMaterialJsonLd(material) {
  const path = publicMaterialPath(material.locale, material.slug);
  const canonical = absolute(path);
  const list = material.list ?? {};
  const editorial = material.editorial ?? {};
  const segment = localeUrlSegment(material.locale);
  const pageId = `${canonical}#page`;
  const resourceId = `${canonical}#learning-resource`;
  const title = jsonLdText(list.title) ?? "";
  const description = jsonLdText(editorial.summary);
  // Mesmo texto exibido no HTML: resumo truncado como no <meta description>.
  const visibleDescription = description ? truncate(description, description) : undefined;
  const level = jsonLdText(editorial.level);
  const theme = jsonLdText(editorial.theme);
  const resourceType = jsonLdText(editorial.resource_type);
  const reviewedAt = jsonLdText(editorial.reviewed_at);
  const authorSlug = jsonLdText(list.author_slug);
  const authorName = jsonLdText(list.author_name);
  // Sem autor no payload nao existe no HTML visivel: nao inventamos Person.
  const hasAuthor = Boolean(authorName || authorSlug);
  const authorProfile = authorSlug ? `${SITE_URL}/portal/professor/${authorSlug}` : undefined;
  const authorId = hasAuthor
    ? (authorProfile ? `${authorProfile}#person` : `${canonical}#person`)
    : undefined;
  const playPath = jsonLdText(material.play_path) ? absolute(material.play_path) : undefined;
  const languages = compactNodes([
    jsonLdLanguage(list.lang_a),
    jsonLdLanguage(list.lang_b),
  ]);
  const cardCount = Number(list.card_count);

  const page = {
    "@type": "WebPage",
    "@id": pageId,
    url: canonical,
    name: title,
    inLanguage: segment === "pt-br" ? "pt-BR" : segment,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    mainEntity: { "@id": resourceId },
    ...(visibleDescription ? { description: visibleDescription } : {}),
  };

  const resource = {
    "@type": "LearningResource",
    "@id": resourceId,
    name: title,
    url: canonical,
    isAccessibleForFree: true,
    provider: { "@id": `${SITE_URL}/#organization` },
    mainEntityOfPage: { "@id": pageId },
    isPartOf: { "@id": `${SITE_URL}/#website` },
    ...(visibleDescription ? { description: visibleDescription } : {}),
    ...(languages.length ? { inLanguage: languages } : {}),
    ...(level ? { educationalLevel: level } : {}),
    ...(theme ? { about: theme } : {}),
    ...(resourceType ? { learningResourceType: resourceType } : {}),
    ...(Number.isFinite(cardCount) && cardCount > 0 ? { numberOfItems: cardCount } : {}),
    ...(reviewedAt ? { dateModified: reviewedAt } : {}),
    ...(authorId ? { author: { "@id": authorId } } : {}),
    ...(playPath
      ? { potentialAction: { "@type": "ViewAction", name: "Jogar agora", target: playPath } }
      : {}),
  };

  const author = hasAuthor
    ? {
        "@type": "Person",
        "@id": authorId,
        name: authorName ?? authorSlug,
        ...(authorName ? { jobTitle: "Professor" } : {}),
        memberOf: { "@id": `${SITE_URL}/#organization` },
        ...(authorProfile ? { url: authorProfile } : {}),
      }
    : null;

  const breadcrumb = {
    "@type": "BreadcrumbList",
    "@id": `${canonical}#breadcrumb`,
    itemListElement: compactNodes([
      { "@type": "ListItem", position: 1, name: "Portal público", item: `${SITE_URL}/portal` },
      { "@type": "ListItem", position: 2, name: "Materiais", item: `${SITE_URL}/${segment}/materiais` },
      title ? { "@type": "ListItem", position: 3, name: title, item: canonical } : null,
    ]),
  };

  return { "@context": "https://schema.org", "@graph": compactNodes([page, resource, author, breadcrumb]) };
}

export function renderMaterialJsonLdScript(material) {
  const serialized = JSON.stringify(buildMaterialJsonLd(material)).replaceAll("<", "\\u003c");
  return `<script id="public-material-jsonld" type="application/ld+json">${serialized}</script>`;
}

export function injectMaterialStructuredData(html, material) {
  return html.replace("</head>", `  ${renderMaterialJsonLdScript(material)}\n</head>`);
}

function assertGenerated(html, material, path) {
  const canonical = absolute(path);
  const canonicals = html.match(/<link rel="canonical"[^>]*>/gi) ?? [];
  if (canonicals.length !== 1) throw new Error(`canonical duplicado ou ausente em ${path}`);
  if (!canonicals[0].includes(canonical)) throw new Error(`canonical incorreto em ${path}`);
  if (!/<h1>[^<]+<\/h1>/i.test(html)) throw new Error(`H1 ausente em ${path}`);
  if (!html.includes("Jogar agora")) throw new Error(`CTA ausente em ${path}`);
  if (!html.includes(material.list.title)) throw new Error(`titulo do material ausente em ${path}`);
  const jsonLdMatch = html.match(/<script id="public-material-jsonld" type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!jsonLdMatch) throw new Error(`JSON-LD ausente em ${path}`);
  const parsedJsonLd = JSON.parse(jsonLdMatch[1].replaceAll("\\u003c", "<"));
  const jsonLdTypes = (parsedJsonLd["@graph"] ?? []).map((node) => node["@type"]);
  if (!jsonLdTypes.includes("LearningResource")) throw new Error(`LearningResource ausente em ${path}`);
  if (!jsonLdTypes.includes("BreadcrumbList")) throw new Error(`BreadcrumbList ausente em ${path}`);
}

function assertGeneratedCatalog(html, path) {
  const canonical = absolute(path);
  const canonicals = html.match(/<link rel="canonical"[^>]*>/gi) ?? [];
  if (canonicals.length !== 1) throw new Error(`canonical duplicado ou ausente em ${path}`);
  if (!canonicals[0].includes(canonical)) throw new Error(`canonical incorreto em ${path}`);
  const robots = html.match(/<meta name="robots"[^>]*>/gi) ?? [];
  if (robots.length !== 1) throw new Error(`meta robots duplicado ou ausente em ${path}`);
  if (!robots[0].includes(DEFAULT_ROBOTS)) throw new Error(`meta robots incorreto em ${path}`);
  if (!/<h1[^>]*>[^<]+<\/h1>/i.test(html)) throw new Error(`H1 ausente em ${path}`);
  if (!html.includes("data-catalog-items") && !html.includes("Ainda não há materiais publicados")) {
    throw new Error(`catalogo sem listagem e sem estado vazio honesto em ${path}`);
  }
}

async function main() {
  const template = readFileSync(templatePath, "utf8");
  const { runtimeSource, runtimeProjectId, materials, catalogs } = await loadPublicMaterials();
  const generatedPaths = [];
  const catalogPaths = [];

  for (const material of materials) {
    const path = publicMaterialPath(material.locale, material.slug);
    const canonical = absolute(path);
    const description = truncate(
      material.editorial?.summary,
      `${material.list.title}: material público com ${material.list.card_count} cards no APE.`,
    );
    let html = applyHead(template, {
      title: `${material.list.title} — ${material.editorial?.level ?? "Inglês"} | APE`,
      description,
      canonical,
    });
    const withContent = html.replace(/<div id="root"><\/div>/i, `<div id="root">${renderMaterialStaticContent(material)}</div>`);
    if (withContent === html) throw new Error(`marcador <div id="root"></div> ausente para ${path}`);
    html = withContent;
    html = injectMaterialStructuredData(html, material);
    html = `<!-- Generated by scripts/prerender-public-materials.mjs for ${path} -->\n${html}`;
    assertGenerated(html, material, path);
    const destination = resolve(distDir, path.slice(1), "index.html");
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, html, "utf8");
    generatedPaths.push(path);
  }

  for (const catalog of catalogs ?? []) {
    const path = publicCatalogPath(catalog.locale);
    const canonical = absolute(path);
    const copy = catalogCopy(catalog.locale);
    const intro = copy.intro.replace("{total}", String(catalog.total ?? (catalog.items ?? []).length));
    let html = applyHead(template, {
      title: `${copy.title} | APE`,
      description: truncate(intro, copy.title),
      canonical,
      robots: DEFAULT_ROBOTS,
    });
    const withContent = html.replace(
      /<div id="root"><\/div>/i,
      `<div id="root">${renderCatalogStaticContent(catalog)}</div>`,
    );
    if (withContent === html) throw new Error(`marcador <div id="root"></div> ausente para ${path}`);
    html = withContent;
    html = `<!-- Generated by scripts/prerender-public-materials.mjs for ${path} -->\n${html}`;
    assertGeneratedCatalog(html, path);
    const destination = resolve(distDir, path.slice(1), "index.html");
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, html, "utf8");
    generatedPaths.push(path);
    catalogPaths.push(path);
  }

  const urls = generatedPaths
    .map((path) => `  <url><loc>${absolute(path)}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`)
    .join("\n");
  writeFileSync(
    sitemapPath,
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
    "utf8",
  );

  writeFileSync(
    reportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        runtimeSource,
        runtimeProjectId,
        materials: materials.length,
        catalogs: catalogPaths.length,
        generatedPaths,
        catalogPaths,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Materiais publicos pre-renderizados: ${generatedPaths.length}`);
  for (const path of generatedPaths) console.log(`  ${path}`);
}

// Importar este modulo (por exemplo, do validador) nao deve disparar o prerender.
const isDirectExecution =
  process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectExecution) {
  main().catch((error) => {
    console.error("Falha ao pre-renderizar materiais publicos:", error);
    process.exitCode = 1;
  });
}

