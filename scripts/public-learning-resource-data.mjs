import { createClient } from "@supabase/supabase-js";
import {
  loadPublicTeacherDirectory,
  resolvePublicDirectoryRuntime,
} from "./public-directory-data.mjs";

const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESOURCES = 2000;
const LIST_CONCURRENCY = 5;

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

function sanitizeResource(row) {
  const id = typeof row?.id === "string" ? row.id.trim() : "";
  const title = typeof row?.title === "string" ? row.title.trim() : "";
  const authorSlug = typeof row?.author_slug === "string" ? row.author_slug.trim() : "";
  const authorName = typeof row?.author_display_name === "string" ? row.author_display_name.trim() : "";

  if (!/^[0-9a-f-]{36}$/i.test(id) || !title) return null;
  if (authorSlug && !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(authorSlug)) return null;

  return {
    id,
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
    author_display_name: authorName || "Professor no APE",
    author_slug: authorSlug || null,
    author_avatar_url: typeof row.author_avatar_url === "string" && row.author_avatar_url.trim() ? row.author_avatar_url.trim() : null,
    list_count: asCount(row.list_count),
    card_count: asCount(row.card_count),
    lists: [],
  };
}

function sanitizeList(row) {
  const id = typeof row?.id === "string" ? row.id.trim() : "";
  const title = typeof row?.title === "string" ? row.title.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !title) return null;

  return {
    id,
    title,
    description: typeof row.description === "string" && row.description.trim() ? row.description.trim() : null,
    order_index: Number.isFinite(Number(row.order_index)) ? Math.trunc(Number(row.order_index)) : 0,
    study_type: typeof row.study_type === "string" && row.study_type.trim() ? row.study_type.trim() : "language",
    lang_a: sanitizeLanguage(row.lang_a, "en"),
    lang_b: sanitizeLanguage(row.lang_b, "pt"),
    labels_a: typeof row.labels_a === "string" && row.labels_a.trim() ? row.labels_a.trim() : null,
    labels_b: typeof row.labels_b === "string" && row.labels_b.trim() ? row.labels_b.trim() : null,
    created_at: asIsoDate(row.created_at),
    updated_at: asIsoDate(row.updated_at),
    card_count: asCount(row.card_count),
  };
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

function fallbackResourcesFromTeachers(teachers) {
  return teachers.flatMap((teacher) => (teacher.folders ?? []).map((folder) => sanitizeResource({
    ...folder,
    author_display_name: teacher.display_name,
    author_slug: teacher.public_slug,
    author_avatar_url: teacher.avatar_url,
    list_count: folder.list_count,
    card_count: folder.card_count,
  }))).filter(Boolean);
}

export function publicLearningResourcePath(id) {
  return `/portal/folder/${id}`;
}

export async function loadPublicLearningResources() {
  const runtime = await resolvePublicDirectoryRuntime();
  if (!runtime) {
    console.warn("[PublicLearningResources] Runtime de produção indisponível; usando fallback do diretório de professores.");
    const directory = await loadPublicTeacherDirectory();
    return {
      runtimeSource: directory.runtimeSource,
      discoveryMode: "teacher-directory-fallback",
      resources: fallbackResourcesFromTeachers(directory.teachers ?? []),
    };
  }

  const client = createClient(runtime.url, runtime.publicValue, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: timedFetch },
  });

  const discovery = await client.rpc("list_public_learning_resource_entries", { _limit: MAX_RESOURCES });
  if (discovery.error && isMissingRpc(discovery.error, "list_public_learning_resource_entries")) {
    console.warn("[PublicLearningResources] RPC canônica ainda não publicada; usando pastas aprovadas pelo diretório público de professores.");
    const directory = await loadPublicTeacherDirectory();
    return {
      runtimeSource: directory.runtimeSource,
      discoveryMode: "teacher-directory-fallback",
      resources: fallbackResourcesFromTeachers(directory.teachers ?? []),
    };
  }

  if (discovery.error) {
    console.warn("[PublicLearningResources] Descoberta indisponível; mantendo o build sem materiais dinâmicos.", discovery.error.message);
    return { runtimeSource: runtime.source, discoveryMode: "unavailable", resources: [] };
  }

  const seen = new Set();
  const resources = (discovery.data ?? [])
    .map(sanitizeResource)
    .filter(Boolean)
    .filter((resource) => {
      if (seen.has(resource.id)) return false;
      seen.add(resource.id);
      return true;
    });

  const hydrated = await mapWithConcurrency(resources, LIST_CONCURRENCY, async (resource) => {
    const response = await client.rpc("get_public_learning_resource_lists", { _folder_id: resource.id });
    if (response.error && isMissingRpc(response.error, "get_public_learning_resource_lists")) {
      return resource;
    }
    if (response.error) {
      console.warn(`[PublicLearningResources] Listas de ${resource.id} indisponíveis.`, response.error.message);
      return resource;
    }

    const lists = (response.data ?? []).map(sanitizeList).filter(Boolean);
    const newestListDate = lists
      .map((list) => list.updated_at)
      .filter(Boolean)
      .sort()
      .at(-1) ?? null;

    return {
      ...resource,
      updated_at: [resource.updated_at, newestListDate].filter(Boolean).sort().at(-1) ?? null,
      list_count: lists.length || resource.list_count,
      card_count: lists.length ? lists.reduce((sum, list) => sum + list.card_count, 0) : resource.card_count,
      lists,
    };
  });

  return {
    runtimeSource: runtime.source,
    discoveryMode: "canonical-rpc",
    resources: hydrated,
  };
}
