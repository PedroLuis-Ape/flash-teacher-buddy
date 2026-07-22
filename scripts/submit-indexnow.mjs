import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const SITE_URL = "https://www.apeeducation.org";
export { SITE_URL };
export const SITE_HOST = new URL(SITE_URL).host;
export const INDEXNOW_KEY = "ed51acee0d4a4b1398698bade3f8c3e8";
export const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
export const INDEXNOW_ENDPOINT = process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow";

export function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

export function extractLocations(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)]
    .map((match) => decodeXml(match[1].trim()))
    .filter(Boolean);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "APE-SEO-Publication/1.1" },
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`${url} respondeu HTTP ${response.status}.`);
  }
  return response.text();
}

export async function collectPublishedUrls() {
  const rootXml = await fetchText(`${SITE_URL}/sitemap.xml`);
  const rootLocations = extractLocations(rootXml);
  const sitemapLocations = rootLocations.filter((url) => url.endsWith(".xml"));

  const pageLocations = sitemapLocations.length
    ? (await Promise.all(sitemapLocations.map(async (url) => extractLocations(await fetchText(url))))).flat()
    : rootLocations;

  const urls = [...new Set(pageLocations)].filter((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" && url.host === SITE_HOST;
    } catch {
      return false;
    }
  });

  if (!urls.length) throw new Error("Nenhuma URL pública foi encontrada nos sitemaps.");
  if (urls.length > 10_000) throw new Error(`O lote possui ${urls.length} URLs; o limite do IndexNow é 10.000.`);
  if (urls.length !== pageLocations.length) {
    throw new Error("O sitemap contém URLs duplicadas, inválidas ou externas ao domínio canônico.");
  }

  return urls;
}

export function validateSelectedUrls(values, publishedUrls) {
  const published = new Set(publishedUrls.map((value) => new URL(value).href));
  const selected = [...new Set(values.map((value) => value.trim()).filter(Boolean))];

  if (!selected.length) throw new Error("A seleção do IndexNow está vazia.");
  if (selected.length > 10_000) throw new Error(`O lote possui ${selected.length} URLs; o limite do IndexNow é 10.000.`);

  return selected.map((value) => {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new Error(`URL inválida na seleção do IndexNow: ${value}`);
    }
    if (url.protocol !== "https:" || url.host !== SITE_HOST) {
      throw new Error(`URL externa ou não HTTPS na seleção do IndexNow: ${value}`);
    }
    if (!published.has(url.href)) {
      throw new Error(`URL ausente do sitemap publicado: ${value}`);
    }
    return url.href;
  });
}

async function readSelectedUrls(publishedUrls) {
  const file = process.env.INDEXNOW_URL_FILE;
  const inline = process.env.INDEXNOW_URLS;
  if (file && inline) throw new Error("Use apenas INDEXNOW_URL_FILE ou INDEXNOW_URLS, não ambos.");

  if (file) {
    const contents = await readFile(file, "utf8");
    return validateSelectedUrls(contents.split(/\r?\n/), publishedUrls);
  }
  if (inline) {
    return validateSelectedUrls(inline.split(/[\r\n,]+/), publishedUrls);
  }
  return publishedUrls;
}

export async function main() {
  const keyContents = (await fetchText(KEY_LOCATION)).trim();
  if (keyContents !== INDEXNOW_KEY) {
    throw new Error("O arquivo público de propriedade do IndexNow não corresponde à chave esperada.");
  }

  const publishedUrls = await collectPublishedUrls();
  const urlList = await readSelectedUrls(publishedUrls);
  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "user-agent": "APE-SEO-Publication/1.1",
    },
    body: JSON.stringify({
      host: SITE_HOST,
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList,
    }),
    signal: AbortSignal.timeout(20_000),
  });

  if (![200, 202].includes(response.status)) {
    const detail = (await response.text()).trim();
    throw new Error(`IndexNow rejeitou o lote com HTTP ${response.status}${detail ? `: ${detail}` : "."}`);
  }

  console.log(`IndexNow recebeu ${urlList.length} URLs públicas (HTTP ${response.status}).`);
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
