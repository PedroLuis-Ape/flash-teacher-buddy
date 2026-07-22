import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { INDEXNOW_KEY } from "./submit-indexnow.mjs";

const CONTRACT_VERSION = 1;
const DEFAULT_ORIGIN = "https://www.apeeducation.org";
const USER_AGENT = "APE-SEO-Monitor/1.0";

function decodeEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'");
}

export function extractSitemapEntries(xml) {
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/gi)].map((match) => {
    const loc = match[1].match(/<loc>([\s\S]*?)<\/loc>/i)?.[1]?.trim() || "";
    const lastmod = match[1].match(/<lastmod>([\s\S]*?)<\/lastmod>/i)?.[1]?.trim() || null;
    return { url: decodeEntities(loc), lastmod: lastmod ? decodeEntities(lastmod) : null };
  });
}

export function extractSitemapLocations(xml) {
  return [...xml.matchAll(/<sitemap>[\s\S]*?<loc>([\s\S]*?)<\/loc>[\s\S]*?<\/sitemap>/gi)]
    .map((match) => decodeEntities(match[1].trim()))
    .filter(Boolean);
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, "i"));
  return match ? decodeEntities(match[2].trim()) : null;
}

function textContent(value) {
  return decodeEntities(value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

export function inspectHtml(html) {
  const links = html.match(/<link\b[^>]*>/gi) || [];
  const canonicalTag = links.find((tag) => (attribute(tag, "rel") || "").toLowerCase().split(/\s+/).includes("canonical"));
  const metas = html.match(/<meta\b[^>]*>/gi) || [];
  const robotContents = metas
    .filter((tag) => ["robots", "googlebot"].includes((attribute(tag, "name") || "").toLowerCase()))
    .map((tag) => (attribute(tag, "content") || "").toLowerCase());
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "";
  const h1 = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || "";
  const htmlTag = html.match(/<html\b[^>]*>/i)?.[0] || "";

  return {
    canonical: canonicalTag ? attribute(canonicalTag, "href") : null,
    noindex: robotContents.some((content) => content.split(/[\s,]+/).includes("noindex")),
    title: textContent(title),
    h1: textContent(h1),
    lang: attribute(htmlTag, "lang"),
    jsonLdCount: (html.match(/<script\b[^>]*type\s*=\s*(["'])application\/ld\+json\1[^>]*>/gi) || []).length,
  };
}

export function parseRobots(robots) {
  const groups = [];
  let group = null;
  let sawRule = false;

  for (const originalLine of robots.split(/\r?\n/)) {
    const line = originalLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === "user-agent") {
      if (!group || sawRule) {
        group = { agents: [], rules: [] };
        groups.push(group);
        sawRule = false;
      }
      group.agents.push(value.toLowerCase());
    } else if (group && (field === "allow" || field === "disallow")) {
      group.rules.push({ type: field, path: value });
      sawRule = true;
    }
  }
  return groups;
}

function robotsPattern(path) {
  const end = path.endsWith("$");
  const raw = end ? path.slice(0, -1) : path;
  const escaped = raw.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${escaped}${end ? "$" : ""}`);
}

export function isRobotsAllowed(url, groups, userAgent = USER_AGENT) {
  const normalizedAgent = userAgent.toLowerCase();
  const applicable = groups.filter((group) => group.agents.some((agent) => agent === "*" || normalizedAgent.includes(agent)));
  const path = `${new URL(url).pathname}${new URL(url).search}`;
  const matches = applicable
    .flatMap((group) => group.rules)
    .filter((rule) => rule.path && robotsPattern(rule.path).test(path))
    .sort((a, b) => b.path.length - a.path.length || (a.type === "allow" ? -1 : 1));
  return matches[0]?.type !== "disallow";
}

export function diffSitemapState(previous, current) {
  if (!previous || previous.contractVersion !== CONTRACT_VERSION || previous.origin !== current.origin) {
    return { baseline: true, changed: [], removed: [], stateChanged: true };
  }
  const oldPages = new Map(previous.pages.map((page) => [page.url, page.lastmod || null]));
  const newPages = new Map(current.pages.map((page) => [page.url, page.lastmod || null]));
  const changed = current.pages
    .filter((page) => !oldPages.has(page.url) || oldPages.get(page.url) !== (page.lastmod || null))
    .map((page) => page.url);
  const removed = previous.pages.filter((page) => !newPages.has(page.url)).map((page) => page.url);
  return { baseline: false, changed, removed, stateChanged: previous.fingerprint !== current.fingerprint };
}

function fingerprint(entries) {
  const canonical = entries
    .map(({ url, lastmod }) => `${url}\t${lastmod || ""}`)
    .sort()
    .join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

function normalizeUrl(value) {
  return new URL(value).href;
}

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        redirect: "follow",
        headers: { "user-agent": USER_AGENT, ...(options.headers || {}) },
        signal: AbortSignal.timeout(20_000),
      });
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * 2 ** attempt));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 2) await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * 2 ** attempt));
    }
  }
  throw lastError || new Error(`${url} não respondeu.`);
}

async function fetchRequiredText(url, expectedType) {
  const response = await fetchWithRetry(url);
  if (!response.ok) throw new Error(`${url} respondeu HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type") || "";
  if (expectedType && !contentType.toLowerCase().includes(expectedType)) {
    throw new Error(`${url} respondeu com Content-Type ${contentType || "ausente"}; esperado ${expectedType}.`);
  }
  return { response, text: await response.text() };
}

async function mapConcurrent(values, concurrency, mapper) {
  const results = new Array(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

async function collectSitemap(origin) {
  const sitemapUrl = `${origin}/sitemap.xml`;
  const root = await fetchRequiredText(sitemapUrl, "xml");
  const childLocations = extractSitemapLocations(root.text);
  const documents = [{ url: sitemapUrl, status: root.response.status }];
  let pages;

  if (childLocations.length) {
    const childResults = await mapConcurrent(childLocations, 4, async (url) => {
      const child = await fetchRequiredText(url, "xml");
      return { url, status: child.response.status, entries: extractSitemapEntries(child.text) };
    });
    documents.push(...childResults.map(({ url, status }) => ({ url, status })));
    pages = childResults.flatMap(({ entries }) => entries);
  } else {
    pages = extractSitemapEntries(root.text);
  }

  if (!pages.length) throw new Error("O sitemap publicado não contém páginas.");
  if (pages.length > 10_000) throw new Error(`O sitemap publicou ${pages.length} URLs; o contrato aceita no máximo 10.000.`);

  const originUrl = new URL(origin);
  const normalized = pages.map((page) => {
    const parsed = new URL(page.url);
    if (parsed.protocol !== "https:" || parsed.host !== originUrl.host) {
      throw new Error(`URL externa ou não HTTPS no sitemap: ${page.url}`);
    }
    return { url: parsed.href, lastmod: page.lastmod };
  });
  if (new Set(normalized.map((page) => page.url)).size !== normalized.length) {
    throw new Error("O sitemap publicado contém URLs duplicadas.");
  }
  return { pages: normalized, documents };
}

async function auditPage(page, robotsGroups) {
  const failures = [];
  if (!isRobotsAllowed(page.url, robotsGroups)) failures.push("blocked_by_robots");
  try {
    const response = await fetchWithRetry(page.url);
    const contentType = response.headers.get("content-type") || "";
    const finalUrl = normalizeUrl(response.url);
    if (response.status !== 200) failures.push(`http_${response.status}`);
    if (finalUrl !== normalizeUrl(page.url)) failures.push("redirected");
    if (!contentType.toLowerCase().includes("text/html")) failures.push("invalid_content_type");
    const html = await response.text();
    const metadata = inspectHtml(html);
    if (!metadata.canonical) failures.push("canonical_missing");
    else {
      try {
        if (normalizeUrl(metadata.canonical) !== normalizeUrl(page.url)) failures.push("canonical_mismatch");
      } catch {
        failures.push("canonical_invalid");
      }
    }
    if (metadata.noindex) failures.push("noindex");
    if (!metadata.title) failures.push("title_missing");
    if (!metadata.h1) failures.push("h1_missing");
    if (!metadata.lang) failures.push("lang_missing");
    if (!metadata.jsonLdCount) failures.push("jsonld_missing");
    return { ...page, status: response.status, finalUrl, contentType, ...metadata, failures };
  } catch (error) {
    failures.push("network_error");
    return { ...page, status: null, failures, error: error instanceof Error ? error.message : String(error) };
  }
}

function parseLlmsInternalLinks(text, origin) {
  const host = new URL(origin).host;
  return [...text.matchAll(/\]\((https:\/\/[^)\s]+)\)/g)]
    .map((match) => match[1])
    .filter((value) => {
      try { return new URL(value).host === host; } catch { return false; }
    })
    .map(normalizeUrl);
}

async function readPreviousState(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw new Error(`Estado anterior inválido: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function ensureParent(file) {
  await mkdir(dirname(resolve(file)), { recursive: true });
}

async function writeJson(file, value) {
  await ensureParent(file);
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseArgs(argv) {
  const options = {
    origin: process.env.SEO_SITE_ORIGIN || DEFAULT_ORIGIN,
    report: "seo-production-report.json",
    previousState: ".seo-monitor/state.json",
    stateOut: ".seo-monitor/state.json",
    changesOut: "indexnow-changed-urls.txt",
  };
  const mapping = new Map([
    ["--origin", "origin"], ["--report", "report"], ["--previous-state", "previousState"],
    ["--state-out", "stateOut"], ["--changes-out", "changesOut"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = mapping.get(argv[index]);
    if (!key || !argv[index + 1]) throw new Error(`Argumento inválido ou incompleto: ${argv[index]}`);
    options[key] = argv[index + 1];
    index += 1;
  }
  options.origin = new URL(options.origin).origin;
  return options;
}

async function writeGithubOutputs(values) {
  if (!process.env.GITHUB_OUTPUT) return;
  await appendFile(process.env.GITHUB_OUTPUT, Object.entries(values).map(([key, value]) => `${key}=${value}\n`).join(""), "utf8");
}

export async function runAudit(options) {
  const generatedAt = new Date().toISOString();
  const failures = [];
  const { text: robotsText } = await fetchRequiredText(`${options.origin}/robots.txt`, "text/plain");
  const robotsGroups = parseRobots(robotsText);
  const { text: llmsText } = await fetchRequiredText(`${options.origin}/llms.txt`, "text/plain");
  const { text: keyText } = await fetchRequiredText(`${options.origin}/${INDEXNOW_KEY}.txt`, "text/plain");
  if (keyText.trim() !== INDEXNOW_KEY) failures.push({ scope: "indexnow", code: "key_mismatch" });

  const sitemap = await collectSitemap(options.origin);
  const pageResults = await mapConcurrent(sitemap.pages, 6, (page) => auditPage(page, robotsGroups));
  for (const page of pageResults) {
    for (const code of page.failures) failures.push({ scope: page.url, code });
  }

  const sitemapSet = new Set(sitemap.pages.map((page) => page.url));
  const llmsLinks = [...new Set(parseLlmsInternalLinks(llmsText, options.origin))];
  const missingLlmsLinks = llmsLinks.filter((url) => !sitemapSet.has(url));
  for (const url of missingLlmsLinks) failures.push({ scope: "llms.txt", code: "link_missing_from_sitemap", url });

  const state = {
    contractVersion: CONTRACT_VERSION,
    origin: options.origin,
    fingerprint: fingerprint(sitemap.pages),
    generatedAt,
    pages: sitemap.pages,
  };
  const previous = await readPreviousState(options.previousState);
  const changes = diffSitemapState(previous, state);
  const report = {
    contractVersion: CONTRACT_VERSION,
    generatedAt,
    origin: options.origin,
    status: failures.length ? "failed" : "passed",
    sitemap: { fingerprint: state.fingerprint, pages: sitemap.pages.length, documents: sitemap.documents },
    discovery: { llmsInternalLinks: llmsLinks.length, indexNowKeyValid: keyText.trim() === INDEXNOW_KEY },
    changes: { baseline: changes.baseline, changed: changes.changed, removed: changes.removed },
    failures,
    pages: pageResults,
  };

  await writeJson(options.report, report);
  await ensureParent(options.changesOut);
  await writeFile(options.changesOut, changes.changed.length ? `${changes.changed.join("\n")}\n` : "", "utf8");

  if (failures.length) {
    await writeGithubOutputs({ status: "failed", changed_count: 0, fingerprint: state.fingerprint, state_changed: false, baseline: changes.baseline });
    throw new Error(`A auditoria de produção falhou em ${failures.length} verificação(ões).`);
  }

  await writeJson(options.stateOut, state);
  await writeGithubOutputs({
    status: "passed",
    changed_count: changes.changed.length,
    removed_count: changes.removed.length,
    fingerprint: state.fingerprint,
    state_changed: changes.stateChanged,
    baseline: changes.baseline,
  });
  return report;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  try {
    const report = await runAudit(options);
    console.log(`SEO de produção aprovado: ${report.sitemap.pages} páginas; ${report.changes.changed.length} URL(s) alterada(s).`);
    if (report.changes.baseline) console.log("Linha de base criada; nenhum envio automático será feito nesta primeira execução.");
    if (report.changes.removed.length) console.log(`${report.changes.removed.length} URL(s) removida(s) foram apenas relatadas.`);
  } catch (error) {
    try {
      await readFile(options.report, "utf8");
    } catch {
      await writeJson(options.report, {
        contractVersion: CONTRACT_VERSION,
        generatedAt: new Date().toISOString(),
        origin: options.origin,
        status: "failed",
        failures: [{
          scope: "audit",
          code: "fatal_error",
          detail: error instanceof Error ? error.message : String(error),
        }],
      });
    }
    await writeGithubOutputs({ status: "failed", changed_count: 0, state_changed: false });
    throw error;
  }
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
