import type { ToolContext, ToolDefinition, ToolHandlerResult } from "@lovable.dev/mcp-js";

interface JsonObject {
  [key: string]: unknown;
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : null;
}

function responsePayload(result: ToolHandlerResult): JsonObject | null {
  const first = result.content?.[0];
  if (!first || first.type !== "text") return null;
  try {
    return asObject(JSON.parse(first.text));
  } catch {
    return null;
  }
}

function scopeOf(args: unknown, payload: JsonObject | null): string | null {
  const input = asObject(args);
  const rawScope = asObject(input?.scope);
  if (rawScope?.kind === "personal" || rawScope?.kind === "institution") return String(rawScope.kind);
  if (input?.scope === "personal" || input?.scope === "institution") return String(input.scope);
  if (typeof input?.institution_id === "string") return "institution";
  if (payload?.scope === "personal" || payload?.scope === "institution") return String(payload.scope);
  for (const key of ["folder", "list", "target"]) {
    const nested = asObject(payload?.[key]);
    if (nested?.scope === "personal" || nested?.scope === "institution") return String(nested.scope);
  }
  return null;
}

function targetTypeOf(args: unknown): string {
  const input = asObject(args);
  if (Array.isArray(input?.updates) || Array.isArray(input?.card_ids) || Array.isArray(input?.cards)) return "cards";
  if (typeof input?.folder_id === "string") return "folder";
  if (typeof input?.list_id === "string") return "list";
  if (input?.target === "folder" || input?.target === "list") return String(input.target);
  return "operation";
}

function targetOf(args: unknown, payload: JsonObject | null, failed: boolean): JsonObject {
  if (failed) {
    const error = asObject(payload?.error);
    return { type: targetTypeOf(args), reason: typeof error?.code === "string" ? error.code : "operation_failed" };
  }
  const target: JsonObject = {};
  const input = asObject(args);
  for (const key of ["folder_id", "list_id", "id", "created_folder_id", "created_list_id"]) {
    if (typeof payload?.[key] === "string") target[key] = payload[key];
  }
  for (const key of ["folder", "list", "target"]) {
    const nested = asObject(payload?.[key]);
    if (typeof nested?.id === "string") {
      target[key] = nested.id;
      target[key + "_id"] = nested.id;
    }
  }
  for (const key of ["card_ids", "list_ids", "updates", "cards"]) {
    if (Array.isArray(input?.[key])) target[key + "_count"] = input[key].length;
  }
  return target;
}

function countOf(args: unknown, payload: JsonObject | null): number {
  const input = asObject(args);
  for (const key of ["cards", "card_ids", "list_ids", "updates"]) {
    if (Array.isArray(input?.[key])) return input[key].length;
  }
  const summary = asObject(payload?.summary);
  for (const value of [
    summary?.cards_created,
    payload?.total_removed,
    payload?.cards_removed,
    payload?.copied_cards,
    payload?.created,
    payload?.updated,
    payload?.reordered,
  ]) {
    if (typeof value === "number") return value;
  }
  return 0;
}

/**
 * Emits the local structured audit event required by FASE 7. The wrapper only
 * records identifiers and counts; it never serializes arguments or results,
 * so card text, tokens and provider details cannot enter the log. A future
 * table-backed audit sink can replace this function without changing tools.
 */
function emitAudit(
  tool: string,
  ctx: ToolContext,
  args: unknown,
  payload: JsonObject | null,
  result: "success" | "error",
  durationMs: number,
): void {
  try {
    console.log(JSON.stringify({
      event: "mcp.audit",
      uid: ctx.getUserId() ?? null,
      tool,
      scope: scopeOf(args, payload),
      target: targetOf(args, payload, result === "error"),
      count: countOf(args, payload),
      result,
      duration_ms: durationMs,
    }));
  } catch {
    // Audit logging must never change the tool result.
  }
}

export function withAudit<T extends ToolDefinition>(tool: T): T {
  const original = tool.handler as unknown as (args: unknown, ctx: ToolContext) => ToolHandlerResult | Promise<ToolHandlerResult>;
  const handler = async (args: unknown, ctx: ToolContext): Promise<ToolHandlerResult> => {
    const startedAt = Date.now();
    try {
      const result = await original(args, ctx);
      emitAudit(tool.name, ctx, args, responsePayload(result), result.isError ? "error" : "success", Date.now() - startedAt);
      return result;
    } catch (error) {
      emitAudit(tool.name, ctx, args, null, "error", Date.now() - startedAt);
      throw error;
    }
  };
  return { ...tool, handler } as unknown as T;
}
