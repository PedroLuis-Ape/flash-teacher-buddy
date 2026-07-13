import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = process.cwd();
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_TEACHERS = 500;
const FOLDER_CONCURRENCY = 4;

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

function isRuntime(value, expectedProjectId) {
  if (!value?.url || !value?.publicValue || !expectedProjectId) return false;
  try {
    const parsed = new URL(value.url);
    const projectId = value.projectId || parsed.hostname.split(".")[0];
    return parsed.protocol === "https:"
      && parsed.hostname === `${expectedProjectId}.supabase.co`
      && projectId === expectedProjectId;
  } catch {
    return false;
  }
}

function readRuntimeSource() {
  return readFileSync(resolve(root, "src/integrations/supabase/platformRuntime.ts"), "utf8");
}

function parseKnownProjects(source) {
  return {
    managedProjectId: source.match(/MANAGED_SUPABASE_PROJECT_ID\s*=\s*"([a-z]{20})"/)?.[1],
    productionProjectId: source.match(/PRODUCTION_DATA_PROJECT_ID\s*=\s*"([a-z]{20})"/)?.[1],
  };
}

function parseSourceFallback(source) {
  const { productionProjectId } = parseKnownProjects(source);
  const keyBlock = source.match(/PRODUCTION_DATA_PUBLIC_VALUE\s*=\s*\[([\s\S]*?)\]\.join\(""\)/)?.[1];
  const publicValue = keyBlock
    ? [...keyBlock.matchAll(/"([^"]*)"/g)].map((match) => match[1]).join("")
    : "";

  if (!productionProjectId || !publicValue) return null;
  return {
    projectId: productionProjectId,
    url: `https://${productionProjectId}.supabase.co`,
    publicValue,
    source: "repository-fallback",
  };
}

function readEnvironmentRuntime(source) {
  const { productionProjectId } = parseKnownProjects(source);
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const publicValue = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  const projectId = process.env.VITE_SUPABASE_PROJECT_ID?.trim();
  const runtime = { projectId, url, publicValue, source: "environment" };
  return isRuntime(runtime, productionProjectId) ? runtime : null;
}

async function readManagedRuntime(source) {
  const { managedProjectId, productionProjectId } = parseKnownProjects(source);
  if (!managedProjectId || !productionProjectId) return null;

  try {
    const response = await timedFetch(
      `https://${managedProjectId}.supabase.co/functions/v1/app-public-config`,
      { headers: { Accept: "application/json" } },
    );
    if (!response.ok) return null;
    const payload = await response.json();
    const runtime = {
      projectId: payload.projectId,
      url: payload.url,
      publicValue: payload.publishableKey,
      source: "managed-runtime",
    };
    return isRuntime(runtime, productionProjectId) ? runtime : null;
  } catch (error) {
    console.warn("[PublicDirectory] Endpoint de runtime indisponível; usando fallback público.", error?.message ?? error);
    return null;
  }
}

export async function resolvePublicDirectoryRuntime() {
  const source = readRuntimeSource();
  return readEnvironmentRuntime(source)
    ?? await readManagedRuntime(source)
    ?? parseSourceFallback(source);
}

function isMissingDiscoveryRpc(error) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""} ${error?.details ?? ""}`.toLowerCase();
  return text.includes("pgrst202")
    || text.includes("42883")
    || text.includes("list_public_teacher_discovery_entries");
}

function asCount(value) {
  const result = Number(value ?? 0);
  return Number.isFinite(result) && result >= 0 ? Math.trunc(result) : 0;
}

function sanitizeTeacher(row) {
  const publicSlug = typeof row?.public_slug === "string" ? row.public_slug.trim() : "";
  const displayName = typeof row?.display_name === "string" ? row.display_name.trim() : "";
  if (!/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(publicSlug) || !displayName) return null;

  return {
    display_name: displayName,
    avatar_url: typeof row.avatar_url === "string" && row.avatar_url.trim() ? row.avatar_url.trim() : null,
    public_slug: publicSlug,
    public_bio: typeof row.public_bio === "string" && row.public_bio.trim() ? row.public_bio.trim() : null,
    public_specialties: Array.isArray(row.public_specialties)
      ? row.public_specialties.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()).slice(0, 12)
      : [],
    folder_count: asCount(row.folder_count),
    list_count: asCount(row.list_count),
    card_count: asCount(row.card_count),
  };
}

function sanitizeFolder(row) {
  const id = typeof row?.id === "string" ? row.id.trim() : "";
  const title = typeof row?.title === "string" ? row.title.trim() : "";
  if (!id || !title || !/^[0-9a-f-]{36}$/i.test(id)) return null;
  return {
    id,
    title,
    description: typeof row.description === "string" && row.description.trim() ? row.description.trim() : null,
    list_count: asCount(row.list_count),
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

export function publicTeacherPath(slug) {
  return `/portal/professor/${encodeURIComponent(slug)}`;
}

export async function loadPublicTeacherDirectory() {
  const runtime = await resolvePublicDirectoryRuntime();
  if (!runtime) {
    console.warn("[PublicDirectory] Runtime público não resolvido; pré-renderização dinâmica ignorada.");
    return { runtimeSource: "unavailable", teachers: [] };
  }

  const client = createClient(runtime.url, runtime.publicValue, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: timedFetch },
  });

  let response = await client.rpc("list_public_teacher_discovery_entries", { _limit: MAX_TEACHERS });
  if (response.error && isMissingDiscoveryRpc(response.error)) {
    console.warn("[PublicDirectory] RPC escalável ainda não publicada; usando diretório legado limitado a 24 professores.");
    response = await client.rpc("search_public_teachers", { _q: "", _limit: 24 });
  }

  if (response.error) {
    console.warn("[PublicDirectory] Diretório público indisponível; mantendo apenas páginas estáticas.", response.error.message);
    return { runtimeSource: runtime.source, teachers: [] };
  }

  const seen = new Set();
  const teachers = (response.data ?? [])
    .map(sanitizeTeacher)
    .filter(Boolean)
    .filter((teacher) => {
      const key = teacher.public_slug.toLocaleLowerCase("en-US");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const hydrated = await mapWithConcurrency(teachers, FOLDER_CONCURRENCY, async (teacher) => {
    try {
      const foldersResponse = await client.rpc("get_public_teacher_folders", { _slug: teacher.public_slug });
      if (foldersResponse.error) throw foldersResponse.error;
      return {
        ...teacher,
        folders: (foldersResponse.data ?? []).map(sanitizeFolder).filter(Boolean),
      };
    } catch (error) {
      console.warn(`[PublicDirectory] Materiais de ${teacher.public_slug} não puderam ser carregados.`, error?.message ?? error);
      return { ...teacher, folders: [] };
    }
  });

  return { runtimeSource: runtime.source, teachers: hydrated };
}
