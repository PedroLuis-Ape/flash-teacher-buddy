import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadPublicTeacherDirectory, publicTeacherPath } from "./public-directory-data.mjs";

const SITE_URL = "https://www.apeeducation.org";
const root = process.cwd();
const distDir = resolve(root, "dist");
const templatePath = resolve(distDir, "index.html");
const sitemapPath = resolve(distDir, "sitemap.xml");
const redirectsPath = resolve(distDir, "_redirects");
const reportPath = resolve(distDir, "public-teacher-prerender-report.json");

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
  if (!pattern.test(source)) throw new Error(`Marcador ausente ao pré-renderizar professor: ${label}`);
  return source.replace(pattern, replacement);
}

function truncateDescription(value, fallback) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim() || fallback;
  return normalized.length <= 155 ? normalized : `${normalized.slice(0, 152).trimEnd()}…`;
}

function teacherDescription(teacher) {
  return truncateDescription(
    teacher.public_bio,
    `Explore materiais públicos, listas e atividades de inglês compartilhados por ${teacher.display_name} no APE.`,
  );
}

function renderSpecialties(teacher) {
  if (!teacher.public_specialties?.length) return "";
  return `<section aria-labelledby="teacher-specialties"><h2 id="teacher-specialties">Especialidades</h2><ul>${teacher.public_specialties
    .map((specialty) => `<li>${escapeHtml(specialty)}</li>`)
    .join("")}</ul></section>`;
}

function renderFolders(teacher) {
  const folders = teacher.folders ?? [];
  if (!folders.length) {
    return `<section aria-labelledby="teacher-materials"><h2 id="teacher-materials">Materiais públicos</h2><p>Este perfil ainda não possui pastas públicas disponíveis.</p></section>`;
  }

  return `<section aria-labelledby="teacher-materials"><h2 id="teacher-materials">Materiais públicos</h2><ul class="teacher-material-list">${folders
    .map((folder) => `<li><a href="/portal/folder/${escapeHtml(folder.id)}"><strong>${escapeHtml(folder.title)}</strong></a>${folder.description ? `<p>${escapeHtml(folder.description)}</p>` : ""}<span>${folder.list_count} listas · ${folder.card_count} cards</span></li>`)
    .join("")}</ul></section>`;
}

export function buildTeacherJsonLd(teacher) {
  const path = publicTeacherPath(teacher.public_slug);
  const canonical = absolute(path);
  const personId = `${canonical}#person`;
  const profileId = `${canonical}#profile`;
  const materialsId = `${canonical}#materials`;
  const description = teacherDescription(teacher);
  const folders = teacher.folders ?? [];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": profileId,
        url: canonical,
        name: `${teacher.display_name} | Perfil público no APE`,
        description,
        inLanguage: "pt-BR",
        isPartOf: { "@id": `${SITE_URL}/#website` },
        mainEntity: { "@id": personId },
        hasPart: folders.length ? { "@id": materialsId } : undefined,
      },
      {
        "@type": "Person",
        "@id": personId,
        name: teacher.display_name,
        description: teacher.public_bio || undefined,
        url: canonical,
        image: teacher.avatar_url || undefined,
        jobTitle: "Professor",
        knowsAbout: teacher.public_specialties?.length ? teacher.public_specialties : undefined,
        memberOf: { "@id": `${SITE_URL}/#organization` },
        mainEntityOfPage: { "@id": profileId },
      },
      ...(folders.length ? [{
        "@type": "ItemList",
        "@id": materialsId,
        name: `Materiais públicos de ${teacher.display_name}`,
        numberOfItems: folders.length,
        itemListElement: folders.map((folder, index) => ({
          "@type": "ListItem",
          position: index + 1,
          url: absolute(`/portal/folder/${folder.id}`),
          name: folder.title,
          description: folder.description || undefined,
        })),
      }] : []),
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Portal público", item: absolute("/portal") },
          { "@type": "ListItem", position: 2, name: teacher.display_name, item: canonical },
        ],
      },
    ],
  };
}

export function renderTeacherStaticContent(teacher) {
  const description = teacherDescription(teacher);
  return `<main id="seo-static-content" data-prerendered="true" data-public-teacher="${escapeHtml(teacher.public_slug)}"><article><p class="teacher-static-brand"><a href="/portal">APE — Portal público</a></p><header class="teacher-static-header">${teacher.avatar_url ? `<img src="${escapeHtml(teacher.avatar_url)}" alt="Foto de ${escapeHtml(teacher.display_name)}" width="112" height="112" loading="eager" />` : ""}<div><p>Perfil público de professor</p><h1>${escapeHtml(teacher.display_name)}</h1><p>@${escapeHtml(teacher.public_slug)}</p></div></header><p class="teacher-static-intro">${escapeHtml(description)}</p><dl class="teacher-static-counts"><div><dt>Pastas</dt><dd>${teacher.folder_count}</dd></div><div><dt>Listas</dt><dd>${teacher.list_count}</dd></div><div><dt>Cards</dt><dd>${teacher.card_count}</dd></div></dl>${renderSpecialties(teacher)}${renderFolders(teacher)}<nav aria-label="Navegação pública"><a href="/portal">Encontrar outros professores</a><a href="/pt-br/fonte-oficial">Sobre o APE</a></nav></article></main>`;
}

const teacherStyle = `<style id="public-teacher-static-style">#seo-static-content{min-height:100vh;background:#09001f;color:#f8f7ff;padding:42px 20px;font-family:Nunito,system-ui,sans-serif}#seo-static-content article{max-width:900px;margin:0 auto}#seo-static-content a{color:#d7a8ff}#seo-static-content h1{font-size:clamp(2rem,6vw,3.75rem);line-height:1.05;margin:.25rem 0}#seo-static-content h2{font-size:1.5rem;margin:2rem 0 .75rem}#seo-static-content p,#seo-static-content li,#seo-static-content dt,#seo-static-content dd{line-height:1.65;color:#d8d3e6}.teacher-static-brand{font-weight:800}.teacher-static-header{display:flex;align-items:center;gap:1.25rem;margin:1.5rem 0}.teacher-static-header img{border-radius:999px;object-fit:cover;border:3px solid #9b5de5}.teacher-static-header p{margin:.25rem 0}.teacher-static-intro{font-size:1.15rem}.teacher-static-counts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.75rem;margin:1.5rem 0}.teacher-static-counts div,.teacher-material-list li{border:1px solid #392653;background:#16072c;border-radius:12px;padding:1rem}.teacher-static-counts dt{font-size:.85rem}.teacher-static-counts dd{font-size:1.5rem;font-weight:800;margin:0;color:#fff}.teacher-material-list{display:grid;gap:.75rem;list-style:none;padding:0}.teacher-material-list p{margin:.35rem 0}.teacher-material-list span{font-size:.9rem}#seo-static-content nav{display:flex;flex-wrap:wrap;gap:1rem;margin-top:2rem}@media(max-width:560px){.teacher-static-header{align-items:flex-start;flex-direction:column}.teacher-static-counts{grid-template-columns:1fr}}</style>`;

export function renderTeacherHtml(template, teacher) {
  const path = publicTeacherPath(teacher.public_slug);
  const canonical = absolute(path);
  const title = `${teacher.display_name} | Materiais públicos de inglês`;
  const description = teacherDescription(teacher);
  const image = teacher.avatar_url || `${SITE_URL}/branding/icon.png`;
  let html = template;

  html = replaceRequired(html, /<html\s+lang="[^"]+"/i, '<html lang="pt-BR"', "html lang");
  html = replaceRequired(html, /<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`, "title");
  html = replaceRequired(html, /<meta name="description" content="[^"]*"\s*\/>/i, `<meta name="description" content="${escapeHtml(description)}" />`, "description");
  html = replaceRequired(html, /<link rel="canonical" href="[^"]*"\s*\/>/i, `<link rel="canonical" href="${canonical}" />`, "canonical");
  html = replaceRequired(html, /<meta property="og:title" content="[^"]*"\s*\/>/i, `<meta property="og:title" content="${escapeHtml(title)}" />`, "og:title");
  html = replaceRequired(html, /<meta property="og:description" content="[^"]*"\s*\/>/i, `<meta property="og:description" content="${escapeHtml(description)}" />`, "og:description");
  html = replaceRequired(html, /<meta property="og:url" content="[^"]*"\s*\/>/i, `<meta property="og:url" content="${canonical}" />`, "og:url");
  html = replaceRequired(html, /<meta property="og:image" content="[^"]*"\s*\/>/i, `<meta property="og:image" content="${escapeHtml(image)}" />`, "og:image");
  html = replaceRequired(html, /<meta property="og:image:alt" content="[^"]*"\s*\/>/i, `<meta property="og:image:alt" content="Foto ou identidade visual de ${escapeHtml(teacher.display_name)}" />`, "og:image:alt");
  html = replaceRequired(html, /<meta name="twitter:title" content="[^"]*"\s*\/>/i, `<meta name="twitter:title" content="${escapeHtml(title)}" />`, "twitter:title");
  html = replaceRequired(html, /<meta name="twitter:description" content="[^"]*"\s*\/>/i, `<meta name="twitter:description" content="${escapeHtml(description)}" />`, "twitter:description");
  html = replaceRequired(html, /<meta name="twitter:image" content="[^"]*"\s*\/>/i, `<meta name="twitter:image" content="${escapeHtml(image)}" />`, "twitter:image");
  html = replaceRequired(html, /<\/head>/i, `${teacherStyle}\n<script id="public-teacher-jsonld" type="application/ld+json">${safeJson(buildTeacherJsonLd(teacher))}</script>\n</head>`, "head");
  html = replaceRequired(html, /<div id="root"><\/div>/i, `<div id="root">${renderTeacherStaticContent(teacher)}</div>`, "root");
  return `<!-- Generated by scripts/prerender-public-teachers.mjs for ${path} -->\n${html}`;
}

export function appendTeacherUrlsToSitemap(sitemap, teachers, lastmod) {
  if (!teachers.length) return sitemap;
  const entries = teachers
    .filter((teacher) => !sitemap.includes(`<loc>${absolute(publicTeacherPath(teacher.public_slug))}</loc>`))
    .map((teacher) => `  <url><loc>${absolute(publicTeacherPath(teacher.public_slug))}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`)
    .join("\n");
  return entries ? sitemap.replace(/\s*<\/urlset>\s*$/i, `\n${entries}\n</urlset>\n`) : sitemap;
}

export function injectTeacherRedirects(redirects, teachers) {
  if (!teachers.length) return redirects;
  const marker = "/*                          /index.html                       200";
  if (!redirects.includes(marker)) throw new Error("Fallback principal não encontrado em dist/_redirects.");
  const dynamicLines = teachers
    .map((teacher) => {
      const path = publicTeacherPath(teacher.public_slug);
      return `${path.padEnd(28)} ${`${path}/index.html`.padEnd(36)} 200`;
    })
    .filter((line) => !redirects.includes(line.trim().split(/\s+/)[0]))
    .join("\n");
  return dynamicLines ? redirects.replace(marker, `${dynamicLines}\n${marker}`) : redirects;
}

export async function prerenderPublicTeachers() {
  if (!existsSync(templatePath)) throw new Error("dist/index.html não encontrado.");
  if (!existsSync(sitemapPath)) throw new Error("dist/sitemap.xml não encontrado.");
  if (!existsSync(redirectsPath)) throw new Error("dist/_redirects não encontrado.");

  const template = readFileSync(templatePath, "utf8");
  const directory = await loadPublicTeacherDirectory();
  const teachers = directory.teachers ?? [];
  const generatedAt = new Date().toISOString();
  const lastmod = generatedAt.slice(0, 10);
  const generatedPaths = [];

  for (const teacher of teachers) {
    const path = publicTeacherPath(teacher.public_slug);
    const destination = resolve(distDir, path.slice(1), "index.html");
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, renderTeacherHtml(template, teacher), "utf8");
    generatedPaths.push(path);
  }

  const sitemap = appendTeacherUrlsToSitemap(readFileSync(sitemapPath, "utf8"), teachers, lastmod);
  writeFileSync(sitemapPath, sitemap, "utf8");
  const redirects = injectTeacherRedirects(readFileSync(redirectsPath, "utf8"), teachers);
  writeFileSync(redirectsPath, redirects, "utf8");

  const report = {
    generatedAt,
    runtimeSource: directory.runtimeSource,
    teacherCount: teachers.length,
    folderCount: teachers.reduce((sum, teacher) => sum + (teacher.folders?.length ?? 0), 0),
    generatedPaths,
  };
  writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(`Pré-render público de professores: ${teachers.length} perfis (${directory.runtimeSource}).`);
  return report;
}

const isDirectExecution = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectExecution) {
  prerenderPublicTeachers().catch((error) => {
    console.error("Falha na pré-renderização pública de professores:", error);
    process.exit(1);
  });
}
