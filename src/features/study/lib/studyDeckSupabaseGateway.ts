import { publicSupabase } from "@/integrations/supabase/publicClient";
import { supabase } from "@/integrations/supabase/client";
import {
  classifyStudyDeckVerificationError,
  type StudyDeckAvailabilityProbe,
} from "./studyDeckAvailability";
import type {
  StudyDeckPage,
  StudyDeckResourceKind,
  StudyDeckSource,
} from "./studyDeckLoader";

interface StudyDeckGatewayContext {
  resourceId: string;
  resourceKind: StudyDeckResourceKind;
  source: StudyDeckSource;
  signal: AbortSignal;
}

interface StudyDeckPageContext extends StudyDeckGatewayContext {
  from: number;
  to: number;
}

function throwIfAborted(signal: AbortSignal): void {
  if (!signal.aborted) return;
  throw new DOMException("The operation was aborted.", "AbortError");
}

function asRows<T>(data: unknown): T[] | null {
  return Array.isArray(data) ? data as T[] : null;
}

function isMissingEmbeddedSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; message?: unknown; details?: unknown };
  const code = typeof candidate.code === "string" ? candidate.code : "";
  const text = `${String(candidate.message ?? "")} ${String(candidate.details ?? "")}`.toLowerCase();
  return code === "42P01"
    || code === "PGRST205"
    || (text.includes("embedded_lists") && (text.includes("does not exist") || text.includes("schema cache")));
}

async function probeEmbeddedPrivateList(
  resourceId: string,
  signal: AbortSignal,
): Promise<{ isEmbedded: boolean; error: unknown }> {
  const result = await (supabase as any)
    .from("embedded_lists")
    .select("list_id")
    .eq("list_id", resourceId)
    .abortSignal(signal)
    .maybeSingle();
  throwIfAborted(signal);

  // The frontend can be published before the migration without breaking every
  // existing private list. Until the new schema exists, all lists behave as
  // the canonical normal-list path.
  if (result.error && isMissingEmbeddedSchemaError(result.error)) {
    return { isEmbedded: false, error: null };
  }
  return { isEmbedded: Boolean(result.data?.list_id), error: result.error };
}

async function fetchEmbeddedStudyDeckPage<T>(
  context: StudyDeckPageContext,
): Promise<StudyDeckPage<T>> {
  const result = await (supabase.rpc as any)("get_embedded_flashcards", {
    _embedded_list_id: context.resourceId,
  })
    .abortSignal(context.signal)
    .range(context.from, context.to);
  throwIfAborted(context.signal);
  return { data: asRows<T>(result.data), error: result.error };
}

/** One canonical Supabase read boundary for Study and MixedStudy. */
export async function fetchStudyDeckPage<T>(
  context: StudyDeckPageContext,
): Promise<StudyDeckPage<T>> {
  throwIfAborted(context.signal);

  if (context.source === "portal-list-rpc") {
    const result = await publicSupabase
      .rpc("get_portal_flashcards", { _list_id: context.resourceId })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .abortSignal(context.signal)
      .range(context.from, context.to);
    throwIfAborted(context.signal);
    return { data: asRows<T>(result.data), error: result.error };
  }

  if (context.source === "private-rest" && context.resourceKind === "list") {
    const embedded = await probeEmbeddedPrivateList(context.resourceId, context.signal);
    if (embedded.error) return { data: null, error: embedded.error };
    if (embedded.isEmbedded) return fetchEmbeddedStudyDeckPage<T>(context);
  }

  const client = context.source === "portal-collection-rest" ? publicSupabase : supabase;
  const scopedQuery = context.resourceKind === "list"
    ? client
        .from("flashcards")
        .select("*")
        .eq("list_id", context.resourceId)
    : client
        .from("flashcards")
        .select("*")
        .eq("collection_id", context.resourceId);
  const result = await scopedQuery
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .abortSignal(context.signal)
    .range(context.from, context.to);
  throwIfAborted(context.signal);
  return { data: asRows<T>(result.data), error: result.error };
}

async function verifyResourceExists(
  context: StudyDeckGatewayContext,
): Promise<{ exists: boolean; error: unknown }> {
  const client = context.source === "portal-collection-rest" ? publicSupabase : supabase;
  const result = context.resourceKind === "list"
    ? await client
        .from("lists")
        .select("id")
        .eq("id", context.resourceId)
        .is("deleted_at", null)
        .abortSignal(context.signal)
        .maybeSingle()
    : await client
        .from("collections")
        .select("id")
        .eq("id", context.resourceId)
        .abortSignal(context.signal)
        .maybeSingle();
  throwIfAborted(context.signal);
  return { exists: Boolean(result.data?.id), error: result.error };
}

async function countVisibleRows(
  context: StudyDeckGatewayContext,
): Promise<{ count: number | null; error: unknown }> {
  const client = context.source === "portal-collection-rest" ? publicSupabase : supabase;
  const scopedQuery = context.resourceKind === "list"
    ? client
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .eq("list_id", context.resourceId)
    : client
        .from("flashcards")
        .select("id", { count: "exact", head: true })
        .eq("collection_id", context.resourceId);
  const result = await scopedQuery
    .is("deleted_at", null)
    .abortSignal(context.signal);
  throwIfAborted(context.signal);
  return { count: result.count, error: result.error };
}

async function probeEmbeddedAvailability(
  context: StudyDeckGatewayContext,
): Promise<StudyDeckAvailabilityProbe | null> {
  if (context.source !== "private-rest" || context.resourceKind !== "list") return null;

  const embedded = await probeEmbeddedPrivateList(context.resourceId, context.signal);
  if (embedded.error) {
    return {
      status: "unconfirmed",
      reason: classifyStudyDeckVerificationError(embedded.error),
    };
  }
  if (!embedded.isEmbedded) return null;

  const result = await (supabase.rpc as any)("get_embedded_list_availability", {
    _embedded_list_id: context.resourceId,
  })
    .abortSignal(context.signal)
    .maybeSingle();
  throwIfAborted(context.signal);
  if (result.error) {
    return {
      status: "unconfirmed",
      reason: classifyStudyDeckVerificationError(result.error),
    };
  }
  if (!result.data) return { status: "unconfirmed", reason: "unknown" };

  const countRow = result.data as { resource_exists: boolean; raw_count: number; playable_count: number };
  return {
    status: "verified",
    resourceExists: Boolean(countRow.resource_exists),
    rawCount: Number(countRow.raw_count),
    playableCount: Number(countRow.playable_count),
  };
}

/**
 * Independent authority check. It never converts an error, missing RPC or RLS
 * denial into zero.
 */
export async function probeStudyDeckAvailability(
  context: StudyDeckGatewayContext,
): Promise<StudyDeckAvailabilityProbe> {
  throwIfAborted(context.signal);

  if (context.source === "portal-list-rpc") {
    const result = await (publicSupabase.rpc as any)("get_portal_playable_card_count", { _list_id: context.resourceId })
      .abortSignal(context.signal)
      .maybeSingle();
    throwIfAborted(context.signal);
    if (result.error) {
      return {
        status: "unconfirmed",
        reason: classifyStudyDeckVerificationError(result.error),
      };
    }
    if (!result.data) return { status: "unconfirmed", reason: "unknown" };
    const countRow = result.data as { resource_exists: boolean; raw_count: number; playable_count: number };
    return {
      status: "verified",
      resourceExists: countRow.resource_exists,
      rawCount: Number(countRow.raw_count),
      playableCount: Number(countRow.playable_count),
    };
  }

  const embeddedAvailability = await probeEmbeddedAvailability(context);
  if (embeddedAvailability) return embeddedAvailability;

  const resource = await verifyResourceExists(context);
  if (resource.error) {
    return {
      status: "unconfirmed",
      reason: classifyStudyDeckVerificationError(resource.error),
    };
  }
  if (!resource.exists) {
    return { status: "verified", resourceExists: false, rawCount: 0 };
  }

  const countResult = await countVisibleRows(context);
  if (countResult.error) {
    return {
      status: "unconfirmed",
      reason: classifyStudyDeckVerificationError(countResult.error),
    };
  }
  if (countResult.count === null) return { status: "unconfirmed", reason: "unknown" };
  return {
    status: "verified",
    resourceExists: true,
    rawCount: countResult.count,
  };
}
