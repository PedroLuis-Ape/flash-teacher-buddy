import { supabase } from "@/integrations/supabase/client";
import {
  normalizeStudyPreset,
  normalizeStudyPresetOverride,
  type StudyPreset,
  type StudyPresetOverride,
} from "./studyPreset";

type GlobalPreferenceRow = {
  mode?: unknown;
  direction?: unknown;
  card_order?: unknown;
  scope?: unknown;
  fast_mode?: unknown;
};

type ListPreferenceRow = GlobalPreferenceRow;

type SupabaseLike = {
  from: (table: string) => any;
};

export function mapGlobalPreferenceRow(row: GlobalPreferenceRow | null | undefined): StudyPreset | null {
  if (!row) return null;
  return normalizeStudyPreset({
    mode: row.mode,
    direction: row.direction,
    order: row.card_order,
    scope: row.scope,
    fastMode: row.fast_mode,
  });
}

export function mapListPreferenceRow(
  row: ListPreferenceRow | null | undefined,
): StudyPresetOverride | null {
  if (!row) return null;
  const override = normalizeStudyPresetOverride({
    mode: row.mode,
    direction: row.direction,
    order: row.card_order,
    scope: row.scope,
    fastMode: row.fast_mode,
  });
  return Object.keys(override).length > 0 ? override : null;
}

export function toGlobalPreferenceRow(userId: string, preset: StudyPreset) {
  const normalized = normalizeStudyPreset(preset);
  return {
    user_id: userId,
    mode: normalized.mode,
    direction: normalized.direction,
    card_order: normalized.order,
    scope: normalized.scope,
    fast_mode: normalized.fastMode,
  };
}

export function toListPreferenceRow(
  userId: string,
  listId: string,
  override: StudyPresetOverride,
) {
  const normalized = normalizeStudyPresetOverride(override);
  return {
    user_id: userId,
    list_id: listId,
    mode: normalized.mode ?? null,
    direction: normalized.direction ?? null,
    card_order: normalized.order ?? null,
    scope: normalized.scope ?? null,
    fast_mode: normalized.fastMode ?? null,
  };
}

export function isMissingStudyPreferenceSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const input = error as { code?: unknown; message?: unknown };
  const code = typeof input.code === "string" ? input.code : "";
  const message = typeof input.message === "string" ? input.message.toLowerCase() : "";
  return ["42P01", "PGRST204", "PGRST205"].includes(code)
    || message.includes("user_study_preferences") && message.includes("not found")
    || message.includes("user_list_study_preferences") && message.includes("not found");
}

export function isRetryableStudyPreferenceError(error: unknown): boolean {
  if (isMissingStudyPreferenceSchemaError(error)) return true;
  if (!error || typeof error !== "object") return false;
  const input = error as { status?: unknown; message?: unknown; code?: unknown };
  const status = typeof input.status === "number" ? input.status : 0;
  const message = typeof input.message === "string" ? input.message.toLowerCase() : "";
  const code = typeof input.code === "string" ? input.code : "";
  return status >= 500
    || status === 0
    || ["57014", "08000", "08003", "08006"].includes(code)
    || message.includes("fetch")
    || message.includes("network")
    || message.includes("timeout");
}

export function createStudyPreferenceRepository(client: SupabaseLike = supabase as unknown as SupabaseLike) {
  return {
    async readGlobal(userId: string): Promise<StudyPreset | null> {
      const { data, error } = await client
        .from("user_study_preferences")
        .select("mode,direction,card_order,scope,fast_mode")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      return mapGlobalPreferenceRow(data);
    },

    async upsertGlobal(userId: string, preset: StudyPreset): Promise<void> {
      const { error } = await client
        .from("user_study_preferences")
        .upsert(toGlobalPreferenceRow(userId, preset), { onConflict: "user_id" });
      if (error) throw error;
    },

    async readListOverride(userId: string, listId: string): Promise<StudyPresetOverride | null> {
      const { data, error } = await client
        .from("user_list_study_preferences")
        .select("mode,direction,card_order,scope,fast_mode")
        .eq("user_id", userId)
        .eq("list_id", listId)
        .maybeSingle();
      if (error) throw error;
      return mapListPreferenceRow(data);
    },

    async upsertListOverride(
      userId: string,
      listId: string,
      override: StudyPresetOverride,
    ): Promise<void> {
      const { error } = await client
        .from("user_list_study_preferences")
        .upsert(toListPreferenceRow(userId, listId, override), {
          onConflict: "user_id,list_id",
        });
      if (error) throw error;
    },

    async deleteListOverride(userId: string, listId: string): Promise<void> {
      const { error } = await client
        .from("user_list_study_preferences")
        .delete()
        .eq("user_id", userId)
        .eq("list_id", listId);
      if (error) throw error;
    },
  };
}

export type StudyPreferenceRepository = ReturnType<typeof createStudyPreferenceRepository>;
