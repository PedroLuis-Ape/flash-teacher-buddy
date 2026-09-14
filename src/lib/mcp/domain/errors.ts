import type { ToolHandlerResult } from "@lovable.dev/mcp-js";

/**
 * Model-facing error codes of the Piteco MCP domain layer.
 *
 * They are stable, safe to expose and never carry credentials, SQL text or
 * schema detail. Raw Supabase/PostgREST errors are translated into these codes
 * before they reach the MCP client.
 */
export type McpErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "ambiguous"
  | "invalid_input"
  | "conflict"
  | "confirmation_required"
  | "unavailable";

export interface McpDomainErrorOptions {
  /** Short, actionable guidance for the calling agent. */
  hint?: string;
  /** Original error, kept out of the MCP payload on purpose. */
  cause?: unknown;
}

export class McpDomainError extends Error {
  readonly code: McpErrorCode;
  readonly hint?: string;

  constructor(code: McpErrorCode, message: string, options: McpDomainErrorOptions = {}) {
    super(message);
    this.name = "McpDomainError";
    this.code = code;
    if (options.hint) this.hint = options.hint;
    if (options.cause !== undefined) {
      Object.defineProperty(this, "cause", { value: options.cause, enumerable: false });
    }
  }
}

export function isMcpDomainError(value: unknown): value is McpDomainError {
  return value instanceof McpDomainError;
}

/**
 * PostgREST / PostgreSQL signals worth translating.
 * Everything else degrades to unavailable so internal detail never leaks.
 */
const ERROR_CODE_MAP: Record<string, McpErrorCode> = {
  "42501": "forbidden", // insufficient_privilege (RLS denial, system guard)
  "42P01": "unavailable", // undefined_table
  "57014": "unavailable", // query_canceled (statement timeout)
  "53300": "unavailable", // too_many_connections
  "22P02": "invalid_input", // invalid_text_representation (malformed uuid)
  "22023": "invalid_input", // invalid_parameter_value
  "23514": "invalid_input", // check_violation (dominio fechado: study_type, visibility, primary_side)
  "23503": "invalid_input", // foreign_key_violation
  "23505": "conflict", // unique_violation
  PGRST116: "not_found",
  PGRST301: "unavailable",
};

const CODE_MESSAGES: Record<McpErrorCode, string> = {
  unauthenticated: "Esta operação exige uma conta APE Piteco autenticada.",
  forbidden: "A conta autenticada não tem permissão para acessar este conteúdo.",
  not_found: "O objeto solicitado não existe na biblioteca desta conta.",
  ambiguous: "O nome informado corresponde a mais de um objeto na biblioteca.",
  invalid_input: "A entrada enviada é inválida para esta operação.",
  conflict: "A operação conflita com o estado atual da biblioteca.",
  confirmation_required:
    "Esta operação é material e exige confirmação em dois passos (preview + token).",
  unavailable: "O backend da biblioteca não respondeu como esperado. Tente novamente.",
};

function readErrorField(error: unknown, field: string): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const value = (error as Record<string, unknown>)[field];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Converts anything thrown by the domain (or by Supabase) into a controlled
 * McpDomainError. Raw provider messages are intentionally not forwarded.
 */
export function toMcpDomainError(error: unknown, fallbackMessage: string): McpDomainError {
  if (isMcpDomainError(error)) return error;

  const providerCode = readErrorField(error, "code");
  const mapped = providerCode ? ERROR_CODE_MAP[providerCode.toUpperCase()] : undefined;
  if (mapped) {
    return new McpDomainError(mapped, CODE_MESSAGES[mapped], { cause: error });
  }
  if (providerCode) {
    return new McpDomainError("unavailable", CODE_MESSAGES.unavailable, { cause: error });
  }
  return new McpDomainError("unavailable", fallbackMessage, { cause: error });
}

/**
 * Operator log kept on-box: code plus a short message, never tokens, headers or
 * row payloads. The MCP client receives only the structured error envelope.
 */
export function logDomainFailure(toolContext: string, error: McpDomainError): void {
  try {
    console.error("[ape-piteco-mcp] tool failed", {
      tool: toolContext,
      code: error.code,
      message: error.message.slice(0, 200),
    });
  } catch {
    // Logging must never break a tool call.
  }
}

/** Single success envelope: {"ok":true, ...payload}. */
export function toolSuccess(payload: Record<string, unknown>): ToolHandlerResult {
  return { content: [{ type: "text", text: JSON.stringify({ ok: true, ...payload }) }] };
}

/** Single failure envelope: {"ok":false,"error":{code,message,hint?}}. */
export function toolErrorResult(error: unknown, toolContext: string): ToolHandlerResult {
  const domainError = toMcpDomainError(error, "A operação falhou.");
  logDomainFailure(toolContext, domainError);
  const payload: Record<string, unknown> = {
    ok: false,
    error: {
      code: domainError.code,
      message: domainError.message,
      ...(domainError.hint ? { hint: domainError.hint } : {}),
    },
  };
  return { content: [{ type: "text", text: JSON.stringify(payload) }], isError: true };
}
