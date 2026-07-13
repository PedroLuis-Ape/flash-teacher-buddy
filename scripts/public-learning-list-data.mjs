import { createClient } from "@supabase/supabase-js";
import {
  loadPublicLearningResources,
} from "./public-learning-resource-data.mjs";
import { resolvePublicDirectoryRuntime } from "./public-directory-data.mjs";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_LISTS = 20_000;
const PREVIEW_LIMIT = 24;
const PREVIEW_CONCURRENCY = 6;

function timedFetch(input, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const upstreamSignal = init.signal;
  if (upstreamSignal) {
    if (upstreamSignal.aborted) controller.abort();
    else upstreamSignal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal })
    .finally(() => clearTimeout(timer));
}

function isMissingRpc(error, rpcName) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return text.includes("pgrst202") || text.includes("42883") || text.includes(rpcName.toLowerCase());
}

function asCount(value) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) && result >= 0 ? Math.trunc(result) : 0;
}

function asIsoDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function sanitizeLanguage(value, fallback) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return /^[a-z]{2,3}(?:-[a-z]{2,4})?$/.test(normalized) ? normalized : fallback;
}

function validUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

export function sanitizePublicLearningList(row) {
  const id = typeof row?.id === "string" ? row.id.trim() : "";
  const folderId = typeof row?.folder_id === "string" ? row.folder_id.trim() : "";
  const title = typeof row?.title === "string" ? row.title.trim() : "";
  const authorSlug = typeof row?.author_slug === "string" ? row.author_slug.trim() : "";
  if (!validUuid(id) || !validUuid(folderId) || !title) return null;
  if (authorSlug && !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(authorSlug)) return null;

  return {
    id,
    folder_id: folderId,
    title,
    description: typeof row.description === "string" && row.description.trim() ? row.description.trim() : null,
    study_type: typeof row.study_type === "string" && row.study_type.trim() ? row.study_type.trim() : "language",
    lang_a: sanitizeLanguage(row.lang_a, "en"),
    lang_b: sanitizeLanguage(row.lang_b, "pt"),
    labels_a: typeof row.labels_a === "string" && row.labels_a.trim() ? row.labels_a.trim() : null,
    labels_b: typeof row.labels_b === "string" && row.labels_b.trim() ? row.labels_b.trim() : null,
    tts_enabled: row.tts_enabled !== false,
    created_at: asIsoDate(row.created_at),
    updated_at: asIsoDate(row.updated_at),
    folder_title: typeof row.folder_title === "string" && row.folder_title.trim() ? row.folder_title.trim() : "Material público",
    author_display_name: typeof row.author_display_name === "string" && row.author_display_name.trim()
      ? row.author_display_name.trim()
      : "Professor no APE",
    author_slug: authorSlug || null,
    author_avatar_url: typeof row.author_avatar_url === "string" && row.author_avatar_url.trim()
      ? row.author_avatar_url.trim()
      : null,
    card_count: asCount(row.card_count),
    cards: [],
  };
}

export function sanitizePublicLearningListCard(row) {
  const id = typeof row?.id === "string" ? row.id.trim() : "";
  const term = typeof row?.term === "string" ? row.term.trim() : "";
  const translation = typeof row?.translation === "string" ? row.translation.trim() : "";
  if (!validUuid(id) || !term || !translation) return null;
  return { id, term, translation, created_at: asIsoDate(row.created_at) };
}

async function mapWithConcurrency(values, limit, worker) {
  const output = new Array(values.length);
  let cursor = 0;
  async function run() {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, run));
  return output;
}

function fallbackListsFromResources(resources) {
  return resources.flatMap((resource) => (resource.lists ?? []).map((list) => sanitizePublicLearningList({
    ...list,
    folder_id: resource.id,
    folder_title: resource.title,
    author_display_name: resource.author_display_name,
    author_slug: resource.author_slug,
    author_avatar_url: resource.author_avatar_url,
    tts_enabled: resource.tts_enabled,
  }))).filter(Boolean);
}

export function publicLearningListPath(id) {
  return `/portal/list/${id}`;
}

export async function loadPublicLearningLists() {
  const runtime = await resolvePublicDirectoryRuntime();
  if (!runtime) {
    const resources = await loadPublicLearningResources();
    return {
      runtimeSource: resources.runtimeSource,
      discoveryMode: "public-resource-fallback",
      lists: fallbackListsFromResources(resources.resources ?? []),
    };
  }

  const client = createClient(runtime.url, runtime.publicValue, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: timedFetch },
  });

  const discovery = await client.rpc("list_public_learning_list_entries", { _limit: MAX_LISTS });
  if (discovery.error && isMissingRpc(discovery.error, "list_public_learning_list_entries")) {
    const resources = await loadPublicLearningResources();
    return {
      runtimeSource: resources.runtimeSource,
      discoveryMode: "public-resource-fallback",
      lists: fallbackListsFromResources(resources.resources ?? []),
    };
  }
  if (discovery.error) {
    console.warn("[PublicLearningLists] Descoberta indisponível; mantendo o build sem listas canônicas.", discovery.error.message);
    return { runtimeSource: runtime.source, discoveryMode: "unavailable", lists: [] };
  }

  const seen = new Set();
  const lists = (discovery.data ?? [])
    .map(sanitizePublicLearningList)
    .filter(Boolean)
    .filter((list) => {
      if (seen.has(list.id)) return false;
      seen.add(list.id);
      return true;
    });

  const hydrated = await mapWithConcurrency(lists, PREVIEW_CONCURRENCY, async (list) => {
    const response = await client.rpc("get_public_learning_list_card_preview", {
      _list_id: list.id,
      _limit: PREVIEW_LIMIT,
    });
    if (response.error && isMissingRpc(response.error, "get_public_learning_list_card_preview")) return list;
    if (response.error) {
      console.warn(`[PublicLearningLists] Prévia de ${list.id} indisponível.`, response.error.message);
      return list;
    }
    return {
      ...list,
      cards: (response.data ?? []).map(sanitizePublicLearningListCard).filter(Boolean),
    };
  });

  return {
    runtimeSource: runtime.source,
    discoveryMode: "canonical-rpc",
    lists: hydrated,
  };
}
