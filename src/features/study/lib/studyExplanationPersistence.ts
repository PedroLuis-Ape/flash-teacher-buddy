import { supabase } from "@/integrations/supabase/client";

export type ExplanationDisplayMode = "off" | "on_demand" | "always";

export interface ExplanationScope {
  type: "list" | "collection";
  id: string;
}

export interface ExplanationPreference {
  mode: ExplanationDisplayMode;
  cards: Record<string, boolean>;
}

export interface RemoteExplanationPreference {
  mode?: ExplanationDisplayMode;
  cards: Record<string, boolean>;
}

export const DEFAULT_EXPLANATION_PREFERENCE: ExplanationPreference = {
  mode: "on_demand",
  cards: {},
};

export function normalizeExplanationMode(value: unknown): ExplanationDisplayMode {
  return value === "off" || value === "always" || value === "on_demand"
    ? value
    : "on_demand";
}

export function resolveExplanationScope(pathname: string): ExplanationScope | null {
  const parts = pathname.split("/").filter(Boolean);
  const listIndex = parts.indexOf("list");
  if (listIndex >= 0 && parts[listIndex + 1]) {
    return { type: "list", id: parts[listIndex + 1] };
  }

  const collectionIndex = parts.indexOf("collection");
  if (collectionIndex >= 0 && parts[collectionIndex + 1]) {
    return { type: "collection", id: parts[collectionIndex + 1] };
  }

  return null;
}

export function explanationStorageKey(scope: ExplanationScope, userId?: string): string {
  return `studyExplanation:${userId ?? "anon"}:${scope.type}:${scope.id}`;
}

export function readLocalExplanationPreference(key: string): ExplanationPreference {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null") as Partial<ExplanationPreference> | null;
    return {
      mode: normalizeExplanationMode(parsed?.mode),
      cards: parsed?.cards && typeof parsed.cards === "object"
        ? parsed.cards as Record<string, boolean>
        : {},
    };
  } catch {
    return DEFAULT_EXPLANATION_PREFERENCE;
  }
}

export function saveLocalExplanationPreference(
  key: string,
  preference: ExplanationPreference,
): void {
  try {
    localStorage.setItem(key, JSON.stringify(preference));
  } catch {
    // Remote persistence remains authoritative for authenticated users.
  }
}

export function explanationCardKey(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

export async function loadRemoteExplanationPreference(
  userId: string,
  scope: ExplanationScope,
): Promise<RemoteExplanationPreference | null> {
  const client = supabase as any;
  const [preferenceResult, cardsResult] = await Promise.all([
    client
      .from("user_study_explanation_preferences")
      .select("display_mode")
      .eq("user_id", userId)
      .eq("scope_type", scope.type)
      .eq("scope_id", scope.id)
      .maybeSingle(),
    client
      .from("user_study_explanation_cards")
      .select("card_key, is_open")
      .eq("user_id", userId)
      .eq("scope_type", scope.type)
      .eq("scope_id", scope.id),
  ]);

  if (preferenceResult.error || cardsResult.error) return null;

  const remoteMode = preferenceResult.data?.display_mode;
  return {
    mode: remoteMode ? normalizeExplanationMode(remoteMode) : undefined,
    cards: Object.fromEntries(
      (cardsResult.data ?? []).map((row: { card_key: string; is_open: boolean }) => [
        row.card_key,
        row.is_open,
      ]),
    ),
  };
}

export async function saveRemoteExplanationMode(
  userId: string,
  scope: ExplanationScope,
  displayMode: ExplanationDisplayMode,
): Promise<void> {
  await (supabase as any).from("user_study_explanation_preferences").upsert({
    user_id: userId,
    scope_type: scope.type,
    scope_id: scope.id,
    display_mode: displayMode,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,scope_type,scope_id" });
}

export async function saveRemoteExplanationCard(
  userId: string,
  scope: ExplanationScope,
  cardKey: string,
  isOpen: boolean,
): Promise<void> {
  await (supabase as any).from("user_study_explanation_cards").upsert({
    user_id: userId,
    scope_type: scope.type,
    scope_id: scope.id,
    card_key: cardKey,
    is_open: isOpen,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,scope_type,scope_id,card_key" });
}
