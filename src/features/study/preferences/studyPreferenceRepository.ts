import { supabase } from "@/integrations/supabase/client";
import {
  normalizeStudyPreset,
  normalizeStudyPresetOverride,
  type StudyPreset,
  type StudyPresetOverride,
} from "./studyPreset";

type GlobalPreferenceRow = {
  game_mode?: unknown;
  mode?: unknown;
  direction?: unknown;
  card_order?: unknown;
  scope?: unknown;
  fast_mode?: unknown;
  play_mode?: unknown;
  play_side?: unknown;
  study_flow_mode?: unknown;
  write_activity_mode?: unknown;
  write_rewrite_side?: unknown;
  write_correction_mode?: unknown;
};

type ListPreferenceRow = GlobalPreferenceRow;

type SupabaseLike = {
  from: (table: string) => any;
};

function normalizeGameMode(value: unknown): StudyPreset["mode"] {
  return normalizeStudyPreset({ mode: value }).mode;
}

export function mapGlobalPreferenceRow(
  row: GlobalPreferenceRow | null | undefined,
  gameMode?: StudyPreset["mode"],
): StudyPreset | null {
  if (!row) return null;
  const identityMode = normalizeGameMode(gameMode ?? row.game_mode ?? row.mode);
  return normalizeStudyPreset({
    mode: identityMode,
    direction: row.direction,
    order: row.card_order,
    scope: row.scope,
    fastMode: row.fast_mode,
    playMode: row.play_mode,
    playSide: row.play_side,
    studyFlowMode: row.study_flow_mode,
    writeActivityMode: row.write_activity_mode,
    writeRewriteSide: row.write_rewrite_side,
    writeCorrectionMode: row.write_correction_mode,
  });
}

export function mapListPreferenceRow(
  row: ListPreferenceRow | null | undefined,
  gameMode?: StudyPreset["mode"],
): StudyPresetOverride | null {
  if (!row) return null;
  const override = normalizeStudyPresetOverride({
    mode: gameMode ? undefined : row.mode,
    direction: row.direction,
    order: row.card_order,
    scope: row.scope,
    fastMode: row.fast_mode,
    playMode: row.play_mode,
    playSide: row.play_side,
    studyFlowMode: row.study_flow_mode,
    writeActivityMode: row.write_activity_mode,
    writeRewriteSide: row.write_rewrite_side,
    writeCorrectionMode: row.write_correction_mode,
  });
  return Object.keys(override).length > 0 ? override : null;
}

export function toGlobalPreferenceRow(
  userId: string,
  preset: StudyPreset,
  gameMode: StudyPreset["mode"] = preset.mode,
) {
  const identityMode = normalizeGameMode(gameMode);
  const normalized = normalizeStudyPreset({ ...preset, mode: identityMode });
  return {
    user_id: userId,
    game_mode: identityMode,
    mode: identityMode,
    direction: normalized.direction,
    card_order: normalized.order,
    scope: normalized.scope,
    fast_mode: normalized.fastMode,
    play_mode: normalized.playMode,
    play_side: normalized.playSide,
    study_flow_mode: normalized.studyFlowMode,
    write_activity_mode: normalized.writeActivityMode,
    write_rewrite_side: normalized.writeRewriteSide,
    write_correction_mode: normalized.writeCorrectionMode,
  };
}

export function toListPreferenceRow(
  userId: string,
  listId: string,
  override: StudyPresetOverride,
  gameMode: StudyPreset["mode"] = normalizeGameMode(override.mode),
) {
  const identityMode = normalizeGameMode(gameMode);
  const normalized = normalizeStudyPresetOverride(override);
  return {
    user_id: userId,
    list_id: listId,
    game_mode: identityMode,
    mode: null,
    direction: normalized.direction ?? null,
    card_order: normalized.order ?? null,
    scope: normalized.scope ?? null,
    fast_mode: normalized.fastMode ?? null,
    play_mode: normalized.playMode ?? null,
    play_side: normalized.playSide ?? null,
    study_flow_mode: normalized.studyFlowMode ?? null,
    write_activity_mode: normalized.writeActivityMode ?? null,
    write_rewrite_side: normalized.writeRewriteSide ?? null,
    write_correction_mode: normalized.writeCorrectionMode ?? null,
  };
}

export function isMissingStudyPreferenceSchemaError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const input = error as { code?: unknown; message?: unknown };
  const code = typeof input.code === "string" ? input.code : "";
  const message = typeof input.message === "string" ? input.message.toLowerCase() : "";
  return ["42P01", "42703", "PGRST204", "PGRST205"].includes(code)
    || message.includes("user_study_preferences") && message.includes("not found")
    || message.includes("user_list_study_preferences") && message.includes("not found")
    || message.includes("game_mode") && message.includes("column")
    || message.includes("play_mode") && message.includes("column")
    || message.includes("play_side") && message.includes("column")
    || message.includes("study_flow_mode") && message.includes("column")
    || message.includes("write_activity_mode") && message.includes("column")
    || message.includes("write_rewrite_side") && message.includes("column")
    || message.includes("write_correction_mode") && message.includes("column");
}

export function isUnacknowledgedPreferenceWrite(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && (error as { name?: unknown }).name === "UnacknowledgedPreferenceWriteError",
  );
}

export function isRetryableStudyPreferenceError(error: unknown): boolean {
  if (isMissingStudyPreferenceSchemaError(error)) return true;
  if (isUnacknowledgedPreferenceWrite(error)) return true;
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
    async readGlobal(userId: string, gameMode: StudyPreset["mode"]): Promise<StudyPreset | null> {
      const identityMode = normalizeGameMode(gameMode);
      const { data, error } = await client
        .from("user_study_preferences")
        .select("game_mode,mode,direction,card_order,scope,fast_mode,play_mode,play_side,study_flow_mode,write_activity_mode,write_rewrite_side,write_correction_mode")
        .eq("user_id", userId)
        .eq("game_mode", identityMode)
        .maybeSingle();
      if (error) throw error;
      return mapGlobalPreferenceRow(data, identityMode);
    },

    async upsertGlobal(
      userId: string,
      gameMode: StudyPreset["mode"],
      preset: StudyPreset,
    ): Promise<void> {
      const identityMode = normalizeGameMode(gameMode);
      const { data, error } = await client
        .from("user_study_preferences")
        .upsert(toGlobalPreferenceRow(userId, preset, identityMode), {
          onConflict: "user_id,game_mode",
        })
        .select("user_id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const unacknowledged = new Error("O banco não confirmou a preferência global salva");
        unacknowledged.name = "UnacknowledgedPreferenceWriteError";
        throw unacknowledged;
      }
    },

    async readListOverride(
      userId: string,
      listId: string,
      gameMode: StudyPreset["mode"],
    ): Promise<StudyPresetOverride | null> {
      const identityMode = normalizeGameMode(gameMode);
      const { data, error } = await client
        .from("user_list_study_preferences")
        .select("game_mode,mode,direction,card_order,scope,fast_mode,play_mode,play_side,study_flow_mode,write_activity_mode,write_rewrite_side,write_correction_mode")
        .eq("user_id", userId)
        .eq("list_id", listId)
        .eq("game_mode", identityMode)
        .maybeSingle();
      if (error) throw error;
      return mapListPreferenceRow(data, identityMode);
    },

    async upsertListOverride(
      userId: string,
      listId: string,
      gameMode: StudyPreset["mode"],
      override: StudyPresetOverride,
    ): Promise<void> {
      const identityMode = normalizeGameMode(gameMode);
      const { data, error } = await client
        .from("user_list_study_preferences")
        .upsert(toListPreferenceRow(userId, listId, override, identityMode), {
          onConflict: "user_id,list_id,game_mode",
        })
        .select("user_id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        const unacknowledged = new Error("O banco não confirmou a preferência da lista salva");
        unacknowledged.name = "UnacknowledgedPreferenceWriteError";
        throw unacknowledged;
      }
    },

    async deleteListOverride(
      userId: string,
      listId: string,
      gameMode: StudyPreset["mode"],
    ): Promise<void> {
      const identityMode = normalizeGameMode(gameMode);
      const { error } = await client
        .from("user_list_study_preferences")
        .delete()
        .eq("user_id", userId)
        .eq("list_id", listId)
        .eq("game_mode", identityMode);
      if (error) throw error;
    },
  };
}

export type StudyPreferenceRepository = ReturnType<typeof createStudyPreferenceRepository>;
