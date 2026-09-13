/**
 * Pre-renderiza as paginas canonicas de material publico curado.
 *
 * Gera HTML inicial (crawlable sem JS), canonical unico e o sitemap dedicado.
 * Falha alto se algum HTML gerado nao tiver H1, canonical correto ou CTA.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  loadPublicMaterials,
  publicMaterialPath,
} from "./public-material-data.mjs";

const SITE_URL = "https://www.apeeducation.org";
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

export function applyHead(html, { title, description, canonical }) {
  let out = html;
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  if (/<meta name="description"[^>]*>/i.test(out)) {
    out = out.replace(/<meta name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(description)}">`);
  } else {
    out = out.replace("</head>", `  <meta name="description" content="${escapeHtml(description)}">\n</head>`);
  }
  // O shell carrega um canonical proprio: remover antes de inserir o correto.
  out = out.replace(/\s*<link rel="canonical"[^>]*>/gi, "");
  out = out.replace(/<meta property="og:url"[^>]*>/i, `<meta property="og:url" content="${canonical}">`);
  out = out.replace("</head>", `  <link rel="canonical" href="${canonical}">\n</head>`);
  return out;
}

function assertGenerated(html, material, path) {
  const canonical = absolute(path);
  const canonicals = html.match(/<link rel="canonical"[^>]*>/gi) ?? [];
  if (canonicals.length !== 1) throw new Error(`canonical duplicado ou ausente em ${path}`);
  if (!canonicals[0].includes(canonical)) throw new Error(`canonical incorreto em ${path}`);
  if (!/<h1>[^<]+<\/h1>/i.test(html)) throw new Error(`H1 ausente em ${path}`);
  if (!html.includes("Jogar agora")) throw new Error(`CTA ausente em ${path}`);
  if (!html.includes(material.list.title)) throw new Error(`titulo do material ausente em ${path}`);
}

async function main() {
  const template = readFileSync(templatePath, "utf8");
  const { runtimeSource, runtimeProjectId, materials } = await loadPublicMaterials();
  const generatedPaths = [];

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
    html = `<!-- Generated by scripts/prerender-public-materials.mjs for ${path} -->\n${html}`;
    assertGenerated(html, material, path);
    const destination = resolve(distDir, path.slice(1), "index.html");
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, html, "utf8");
    generatedPaths.push(path);
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
      { generatedAt: new Date().toISOString(), runtimeSource, runtimeProjectId, materials: materials.length, generatedPaths },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Materiais publicos pre-renderizados: ${generatedPaths.length}`);
  for (const path of generatedPaths) console.log(`  ${path}`);
}

main().catch((error) => {
  console.error("Falha ao pre-renderizar materiais publicos:", error);
  process.exitCode = 1;
});

