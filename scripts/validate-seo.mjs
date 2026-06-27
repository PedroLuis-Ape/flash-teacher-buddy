import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

const indexHtml = read("index.html");
const robotsTxt = read("public/robots.txt");
const sitemapXml = read("public/sitemap.xml");
const redirects = read("public/_redirects");
const llmsTxt = read("public/llms.txt");
const notFoundSource = read("src/pages/NotFound.tsx");
const manifest = JSON.parse(read("public/manifest.webmanifest"));

const errors = [];
const assert = (condition, message) => {
  if (!condition) errors.push(message);
};

const SITE_ORIGIN = "https://www.apeeducation.org";
const REQUIRED_PUBLIC_PATHS = [
  "/",
  "/portal",
  "/ingles-para-iniciantes",
  "/atividades-de-ingles",
  "/flashcards-de-ingles",
  "/para-professores",
  "/about",
];

function wildcardDisallowRules(text) {
  const rules = [];
  let wildcardGroup = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;

    const userAgent = line.match(/^user-agent:\s*(.+)$/i);
    if (userAgent) {
      wildcardGroup = userAgent[1].trim() === "*";
      continue;
    }

    const disallow = line.match(/^disallow:\s*(.*)$/i);
    if (wildcardGroup && disallow?.[1]?.trim()) {
      rules.push(disallow[1].trim());
    }
  }

  return rules;
}

function pathFromUrl(value) {
  try {
    return new URL(value, SITE_ORIGIN).pathname;
  } catch {
    return null;
  }
}

function isBlocked(path, disallowRules) {
  return disallowRules.some((rule) => {
    if (rule.endsWith("$")) return path === rule.slice(0, -1);
    return path.startsWith(rule);
  });
}

assert(
  /<html\s+lang=["']pt-BR["']/i.test(indexHtml),
  'index.html must declare <html lang="pt-BR">.',
);
assert(
  !/"@type"\s*:\s*"SearchAction"/.test(indexHtml),
  "Do not publish SearchAction until the public search URL is crawlable and documented.",
);
assert(
  manifest.lang === "pt-BR",
  'manifest.webmanifest must declare "lang": "pt-BR".',
);

const specificSearchBotGroup =
  /^user-agent:\s*(Googlebot|Bingbot|OAI-SearchBot|PerplexityBot)\s*$/im;
assert(
  !specificSearchBotGroup.test(robotsTxt),
  "Search bots must inherit the wildcard private-route rules; a separate group can accidentally bypass them.",
);
assert(
  /Sitemap:\s*https:\/\/www\.apeeducation\.org\/sitemap\.xml/i.test(robotsTxt),
  "robots.txt must advertise the canonical sitemap.",
);

const disallowRules = wildcardDisallowRules(robotsTxt);
assert(disallowRules.length > 0, "robots.txt must define private-route exclusions.");

const sitemapUrls = [
  ...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g),
].map((match) => match[1].trim());
const sitemapPaths = sitemapUrls.map(pathFromUrl).filter(Boolean);

for (const url of sitemapUrls) {
  assert(
    url.startsWith(`${SITE_ORIGIN}/`),
    `Sitemap URL must use the canonical origin: ${url}`,
  );
  const path = pathFromUrl(url);
  assert(path && !isBlocked(path, disallowRules), `Sitemap URL is blocked by robots.txt: ${url}`);
}

for (const path of REQUIRED_PUBLIC_PATHS) {
  assert(sitemapPaths.includes(path), `Required public path is missing from sitemap.xml: ${path}`);
}
assert(!sitemapPaths.includes("/landing"), "/landing must redirect to / and must not be in sitemap.xml.");
assert(!sitemapPaths.includes("/auth"), "/auth is private and must not be in sitemap.xml.");

const llmsUrls = [...llmsTxt.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)]
  .map((match) => match[1].trim())
  .filter((value) => /^https?:\/\//i.test(value));
const llmsPaths = llmsUrls.map(pathFromUrl).filter(Boolean);

assert(llmsUrls.length > 0, "llms.txt must link to canonical public pages.");
assert(
  llmsTxt.includes("Somente páginas e materiais explicitamente públicos"),
  "llms.txt must explain that private user data is outside its discovery scope.",
);

for (const url of llmsUrls) {
  assert(
    url.startsWith(`${SITE_ORIGIN}/`),
    `llms.txt URL must use the canonical origin: ${url}`,
  );
  const path = pathFromUrl(url);
  assert(path && !isBlocked(path, disallowRules), `llms.txt links to a robots-blocked path: ${url}`);
}

for (const path of REQUIRED_PUBLIC_PATHS) {
  assert(llmsPaths.includes(path), `Required public path is missing from llms.txt: ${path}`);
}

assert(
  /robots=["']noindex,nofollow,noarchive["']/.test(notFoundSource),
  "NotFound must emit a noindex,nofollow,noarchive robots directive.",
);
assert(
  /canonicalPath=\{null\}/.test(notFoundSource),
  "NotFound must not emit a canonical URL for invalid routes.",
);
assert(
  notFoundSource.includes("Página não encontrada"),
  "NotFound must present a localized Portuguese heading.",
);

const redirectLines = redirects
  .split(/\r?\n/)
  .map((line) => line.replace(/#.*$/, "").trim())
  .filter(Boolean);
const landingRedirectIndex = redirectLines.findIndex((line) =>
  /^\/landing\s+\/\s+301!?$/.test(line),
);
const spaFallbackIndex = redirectLines.findIndex((line) =>
  /^\/\*\s+\/index\.html\s+200!?$/.test(line),
);
assert(landingRedirectIndex >= 0, "public/_redirects must permanently redirect /landing to /.");
assert(spaFallbackIndex >= 0, "public/_redirects must keep the SPA fallback.");
assert(
  landingRedirectIndex >= 0 &&
    spaFallbackIndex >= 0 &&
    landingRedirectIndex < spaFallbackIndex,
  "The /landing redirect must appear before the SPA fallback.",
);

if (errors.length > 0) {
  console.error("SEO/GEO validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `SEO/GEO validation passed: ${sitemapUrls.length} sitemap URLs, ${llmsUrls.length} llms.txt URLs and ${disallowRules.length} private-route rules.`,
);
