const SITE_URL = "https://www.apeeducation.org";
const SITE_HOST = new URL(SITE_URL).host;
const INDEXNOW_KEY = "ed51acee0d4a4b1398698bade3f8c3e8";
const KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
const INDEXNOW_ENDPOINT = process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow";

function decodeXml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function extractLocations(xml) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/g)]
    .map((match) => decodeXml(match[1].trim()))
    .filter(Boolean);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "APE-SEO-Publication/1.0" },
  });
  if (!response.ok) {
    throw new Error(`${url} respondeu HTTP ${response.status}.`);
  }
  return response.text();
}

async function collectPublishedUrls() {
  const rootXml = await fetchText(`${SITE_URL}/sitemap.xml`);
  const rootLocations = extractLocations(rootXml);
  const sitemapLocations = rootLocations.filter((url) => url.endsWith(".xml"));

  const pageLocations = sitemapLocations.length
    ? (await Promise.all(sitemapLocations.map(async (url) => extractLocations(await fetchText(url))))).flat()
    : rootLocations;

  const urls = [...new Set(pageLocations)].filter((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && url.host === SITE_HOST;
  });

  if (!urls.length) throw new Error("Nenhuma URL pública foi encontrada nos sitemaps.");
  if (urls.length > 10_000) throw new Error(`O lote possui ${urls.length} URLs; o limite do IndexNow é 10.000.`);
  if (urls.length !== pageLocations.length) {
    throw new Error("O sitemap contém URLs duplicadas, inválidas ou externas ao domínio canônico.");
  }

  return urls;
}

async function main() {
  const keyContents = (await fetchText(KEY_LOCATION)).trim();
  if (keyContents !== INDEXNOW_KEY) {
    throw new Error("O arquivo público de propriedade do IndexNow não corresponde à chave esperada.");
  }

  const urlList = await collectPublishedUrls();
  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json; charset=utf-8",
      "user-agent": "APE-SEO-Publication/1.0",
    },
    body: JSON.stringify({
      host: SITE_HOST,
      key: INDEXNOW_KEY,
      keyLocation: KEY_LOCATION,
      urlList,
    }),
  });

  if (![200, 202].includes(response.status)) {
    const detail = (await response.text()).trim();
    throw new Error(`IndexNow rejeitou o lote com HTTP ${response.status}${detail ? `: ${detail}` : "."}`);
  }

  console.log(`IndexNow recebeu ${urlList.length} URLs públicas (HTTP ${response.status}).`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
