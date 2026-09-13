import { publicSupabase } from "@/integrations/supabase/publicClient";

/**
 * Eventos first-party de produto.
 *
 * Contrato: nunca lancar, nunca bloquear render, nunca enviar PII. A allowlist
 * de chaves espelha a do servidor (record_product_event_v1); chave fora da
 * lista e descartada antes do envio, e nome desconhecido nem chama a RPC.
 */
export const PRODUCT_EVENT_NAMES = [
  "featured_resource_impression",
  "featured_resource_play",
  "public_resource_view",
  "public_search_used",
  "guest_game_start",
  "guest_game_complete",
  "guest_resume",
  "signup_sync_cta_view",
  "signup_after_guest",
  "carousel_slide_view",
  "carousel_interaction",
] as const;

export type ProductEventName = (typeof PRODUCT_EVENT_NAMES)[number];

const ALLOWED_KEYS: Record<ProductEventName, readonly string[]> = {
  featured_resource_impression: ["resource_slug", "position"],
  featured_resource_play: ["resource_slug"],
  public_resource_view: ["resource_slug"],
  public_search_used: ["result_count", "has_filters"],
  guest_game_start: ["mode"],
  guest_game_complete: ["mode", "round_count"],
  guest_resume: ["mode"],
  signup_sync_cta_view: [],
  signup_after_guest: ["outcome"],
  carousel_slide_view: ["slide_index"],
  carousel_interaction: ["slide_index", "action"],
};

const MAX_STRING_LENGTH = 120;
const seenOnce = new Set<string>();

/**
 * Evento so sai em producao real. O cliente publico cai em producao quando o
 * ambiente nao esta configurado, entao sem este portao `npm run dev` gravaria
 * na tabela de producao.
 */
export function productEventsEnabled(): boolean {
  try {
    if (typeof window === "undefined") return false;
    const host = window.location.hostname;
    if (!host) return false;
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) return false;
    return host === "apeeducation.org" || host.endsWith(".apeeducation.org");
  } catch {
    return false;
  }
}

export interface ProductEventOptions {
  locale?: string;
  surface?: string;
}

/** Descarta tudo que nao esta na allowlist do evento. Nome desconhecido => null. */
export function sanitizeProductPayload(
  name: string,
  payload: Record<string, unknown> = {},
): Record<string, unknown> | null {
  if (!Object.prototype.hasOwnProperty.call(ALLOWED_KEYS, name)) return null;
  const allowed = ALLOWED_KEYS[name as ProductEventName];
  const safe: Record<string, unknown> = {};
  for (const key of allowed) {
    const value = payload[key];
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      const trimmed = value.trim().slice(0, MAX_STRING_LENGTH);
      if (trimmed) safe[key] = trimmed;
      continue;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      safe[key] = value;
      continue;
    }
    if (typeof value === "boolean") safe[key] = value;
  }
  return safe;
}

export async function trackProductEvent(
  name: string,
  payload: Record<string, unknown> = {},
  options: ProductEventOptions = {},
): Promise<boolean> {
  const safe = sanitizeProductPayload(name, payload);
  if (safe === null) return false;
  if (!productEventsEnabled()) return false;
  try {
    const { error } = await (publicSupabase.rpc as never as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: unknown }>)("record_product_event_v1", {
      _name: name,
      _payload: safe,
      // Sem locale conhecido, grava nulo: rotular todo mundo como pt-BR mentia.
      _locale: options.locale ?? null,
      _surface: options.surface ?? null,
    });
    return !error;
  } catch {
    // Evento nunca pode quebrar a experiencia do visitante.
    return false;
  }
}

/** Garante uma unica emissao por pagina (ex.: impressao do destaque). */
export async function trackProductEventOnce(
  key: string,
  name: string,
  payload: Record<string, unknown> = {},
  options: ProductEventOptions = {},
): Promise<boolean> {
  if (seenOnce.has(key)) return false;
  seenOnce.add(key);
  return trackProductEvent(name, payload, options);
}

export function resetProductEventOnceForTests() {
  seenOnce.clear();
}
