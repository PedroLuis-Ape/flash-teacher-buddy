/**
 * Dados publicos dos materiais curados, usados pelo prerender e pelo sitemap.
 *
 * Le apenas o que a curadoria aprovou (`list_public_resources_v1` ja filtra
 * status/is_indexable e aplica o quality gate no servidor).
 */
import { createClient } from "@supabase/supabase-js";
import { resolvePublicDirectoryRuntime } from "./public-directory-data.mjs";

const REQUEST_TIMEOUT_MS = 8_000;
const SAMPLE_CONCURRENCY = 4;

export const MATERIAL_LOCALES = ["pt-BR", "en", "es", "fr", "it"];

const URL_SEGMENT = {
  "pt-BR": "pt-br",
  en: "en",
  es: "es",
  fr: "fr",
  it: "it",
};

export function localeUrlSegment(locale) {
  return URL_SEGMENT[locale] ?? "pt-br";
}

export function publicMaterialPath(locale, slug) {
  return `/${localeUrlSegment(locale)}/material/${slug}`;
}

export function publicCatalogPath(locale) {
  return `/${localeUrlSegment(locale)}/materiais`;
}

function timedFetch(input, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function isMissingRpc(error, rpcName) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return text.includes("pgrst202") || text.includes("42883") || text.includes(rpcName.toLowerCase());
}

async function mapWithConcurrency(items, limit, worker) {
  const results = [];
  let cursor = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

export async function loadPublicMaterials() {
  const runtime = await resolvePublicDirectoryRuntime();
  if (!runtime) return { runtimeSource: null, runtimeProjectId: null, materials: [] };

  const client = createClient(runtime.url, runtime.publicValue, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: timedFetch },
  });

  const entries = [];
  const catalogs = [];
  for (const locale of MATERIAL_LOCALES) {
    const { data, error } = await client.rpc("list_public_resources_v1", {
      _locale: locale,
      _limit: 200,
      _offset: 0,
    });
    if (error) {
      // Projeto sem a migration nao deve quebrar o build.
      if (isMissingRpc(error, "list_public_resources_v1")) {
        catalogs.push({ locale, items: [], total: 0, source: "rpc-unavailable" });
        continue;
      }
      throw error;
    }
    if (Array.isArray(data?.items)) {
      for (const entry of data.items) entries.push({ locale, ...entry });
      catalogs.push({
        locale,
        items: data.items.map((entry) => ({ locale, ...entry })),
        total: Number.isFinite(Number(data.total)) ? Number(data.total) : data.items.length,
        source: "rpc",
      });
    } else {
      catalogs.push({ locale, items: [], total: 0, source: "rpc-invalid-shape" });
    }
  }

  const materials = await mapWithConcurrency(entries, SAMPLE_CONCURRENCY, async (entry) => {
    const { data, error } = await client.rpc("get_public_resource_v1", {
      _locale: entry.locale,
      _slug: entry.slug,
    });
    if (error || !data || data.source !== "editorial") return null;
    return { ...data, locale: entry.locale };
  });

  return {
    runtimeSource: runtime.source ?? null,
    runtimeProjectId: runtime.projectId ?? null,
    materials: materials.filter(Boolean),
    catalogs,
  };
}
