import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SITE_URL = "https://www.apeeducation.org";
const distDir = resolve(process.cwd(), "dist");
const rootSitemapPath = resolve(distDir, "sitemap.xml");

const segments = [
  "sitemap-static.xml",
  "sitemap-teachers.xml",
  "sitemap-folders.xml",
  "sitemap-lists.xml",
];

const emptyUrlset = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</urlset>\n';

if (!existsSync(rootSitemapPath)) {
  throw new Error("dist/sitemap.xml ausente depois do build do Vite.");
}

const staticSitemap = readFileSync(rootSitemapPath, "utf8");
if (!/<urlset\b/i.test(staticSitemap) || !/<\/urlset>/i.test(staticSitemap)) {
  throw new Error("O sitemap estatico de origem nao e um urlset valido.");
}

writeFileSync(resolve(distDir, segments[0]), staticSitemap, "utf8");
for (const segment of segments.slice(1)) {
  writeFileSync(resolve(distDir, segment), emptyUrlset, "utf8");
}

const index = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...segments.map((segment) => `  <sitemap><loc>${SITE_URL}/${segment}</loc></sitemap>`),
  "</sitemapindex>",
  "",
].join("\n");

writeFileSync(rootSitemapPath, index, "utf8");
console.log(`Sitemaps segmentados preparados: ${segments.join(", ")}.`);
