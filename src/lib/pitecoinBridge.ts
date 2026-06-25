import { supabase } from "@/integrations/supabase/client";
import { FEATURE_FLAGS } from "./featureFlags";

export const REWARD_AMOUNTS = {
  CORRECT_ANSWER: 5,
  SESSION_BONUS: 10,
  SESSION_BONUS_MIN_CORRECT: 10,
  SESSION_COMPLETE: 20,
  WEEKLY_CHALLENGE: 100,
  DAILY_LOGIN: 10,
  STREAK_DAILY: 5,
  MAX_STREAK_BONUS: 35,
  DAILY_CAP: 500,
  CONVERSION_RATE: 100,
} as const;

export interface EconomyProfile {
  balance_pitecoin: number;
  xp_total: number;
  pts_weekly: number;
  level: number;
  current_streak: number;
  best_streak: number;
  last_daily_reward: string | null;
  last_conversion: string | null;
}

export interface RewardBreakdown {
  normal_activity?: number;
  first_activity_today?: number;
  daily_goal?: number;
  first_list_completion?: number;
  unique_achievements?: number;
  streak?: number;
  milestones?: number;
  repeat_number_today?: number;
  daily_cap?: number;
  pts_awarded?: number;
  xp_awarded?: number;
  reason?: string;
}

export interface RewardResult {
  success: boolean;
  ptsAwarded: number;
  xpAwarded: number;
  pitecoinAwarded: number;
  newBalance?: number;
  alreadyProcessed?: boolean;
  breakdown?: RewardBreakdown;
  error?: string;
  message?: string;
}

const EMPTY_REWARD: RewardResult = {
  success: true,
  ptsAwarded: 0,
  xpAwarded: 0,
  pitecoinAwarded: 0,
};

function failure(error: string, message?: string): RewardResult {
  return {
    success: false,
    ptsAwarded: 0,
    xpAwarded: 0,
    pitecoinAwarded: 0,
    error,
    message,
  };
}

function emitEconomyChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pitecoin:changed"));
  }
}

function parseRewardPayload(data: any): RewardResult {
  const breakdown = (data?.breakdown ?? data?.reward_breakdown ?? undefined) as
    | RewardBreakdown
    | undefined;

  return {
    success: data?.success === true,
    ptsAwarded: Number(breakdown?.pts_awarded ?? data?.pts_awarded ?? 0),
    xpAwarded: Number(breakdown?.xp_awarded ?? data?.xp_awarded ?? 0),
    pitecoinAwarded: Number(data?.reward_amount ?? data?.pitecoin_awarded ?? 0),
    newBalance:
      data?.new_balance === undefined || data?.new_balance === null
        ? undefined
        : Number(data.new_balance),
    alreadyProcessed: data?.already_processed === true,
    breakdown,
    error: data?.error ? String(data.error) : undefined,
    message: data?.message ? String(data.message) : undefined,
  };
}

/**
 * Records the final state of one card inside the active study session.
 * The server validates auth.uid(), session ownership and card membership.
 * No points are minted here; the answer is only staged for the final,
 * idempotent session settlement.
 */
export async function recordStudyAnswer(
  sessionId: string,
  flashcardId: string,
  correct: boolean,
  skipped = false,
): Promise<{ success: boolean; error?: string }> {
  if (!FEATURE_FLAGS.economy_enabled || !sessionId || !flashcardId) {
    return { success: false, error: "ECONOMY_DISABLED_OR_CONTEXT_MISSING" };
  }

  try {
    const { data, error } = await (supabase as any).rpc("ensure_piteco_profile", {
      p_session_id: sessionId,
      p_flashcard_id: flashcardId,
      p_correct: correct,
      p_skipped: skipped,
    });

    if (error) return { success: false, error: error.code ?? error.message };
    return data?.success
      ? { success: true }
      : { success: false, error: String(data?.error ?? "ANSWER_NOT_RECORDED") };
  } catch (error) {
    console.error("[PiteCOIN] Failed to record study answer:", error);
    return { success: false, error: "ANSWER_NOT_RECORDED" };
  }
}

/**
 * Settles a study session exactly once. The server calculates all rewards,
 * streaks, daily caps, first-completion bonuses and achievements, then marks
 * the session as granted/rejected atomically.
 */
export async function settleStudySession(
  sessionId: string,
  fillMissing = true,
): Promise<RewardResult> {
  if (!FEATURE_FLAGS.economy_enabled || !sessionId) {
    return failure("ECONOMY_DISABLED_OR_CONTEXT_MISSING");
  }

  try {
    const { data, error } = await (supabase as any).rpc("ensure_piteco_profile", {
      p_session_id: sessionId,
      p_fill_missing: fillMissing,
    });

    if (error) return failure(error.code ?? "SETTLEMENT_FAILED", error.message);

    const result = parseRewardPayload(data);
    if (result.success || result.alreadyProcessed) emitEconomyChanged();
    return result;
  } catch (error) {
    console.error("[PiteCOIN] Failed to settle study session:", error);
    return failure("SETTLEMENT_FAILED", "Não foi possível calcular a recompensa agora.");
  }
}

/**
 * Legacy compatibility entry point. New study code must use
 * recordStudyAnswer() and settleStudySession() with explicit identifiers.
 */
export async function awardPoints(
  _userId: string,
  _amount: number,
  source: string,
): Promise<RewardResult> {
  if (!FEATURE_FLAGS.economy_enabled) return failure("ECONOMY_DISABLED");

  // FlipStudyView historically emitted this event before useStudyEngine.
  // Keeping it as a harmless acknowledgement prevents duplicate rewards.
  if (source.trim().toLocaleLowerCase().includes("flashcard_correct")) {
    return EMPTY_REWARD;
  }

  return failure(
    "SESSION_CONTEXT_REQUIRED",
    "A recompensa precisa do identificador explícito da sessão e do card.",
  );
}

export async function flushAwardQueue(_userId: string): Promise<RewardResult> {
  return EMPTY_REWARD;
}

export function flushAllAwardQueues(): void {
  // Rewards are persisted immediately by the server-authoritative RPCs.
}

export async function convertPointsIfNeeded(userId: string): Promise<void> {
  if (!FEATURE_FLAGS.economy_enabled || !FEATURE_FLAGS.conversion_cron_enabled) return;
  const { checkAndPerformConversion } = await import("./conversionEngine");
  await checkAndPerformConversion(userId);
}

/**
 * The current canonical reward rules grant the daily/streak bonuses when the
 * first valid study session is settled. There is no separate login-only mint.
 */
export async function checkDailyLogin(_userId: string): Promise<boolean> {
  return false;
}

export async function getEconomyProfile(userId: string): Promise<EconomyProfile | null> {
  if (!FEATURE_FLAGS.economy_enabled || !userId) return null;

  try {
    const ensured = await (supabase as any).rpc("ensure_piteco_profile");
    if (ensured.error || !ensured.data?.success) return null;

    const { data, error } = await supabase
      .from("profiles")
      .select(
        "balance_pitecoin, xp_total, pts_weekly, level, current_streak, best_streak, last_daily_reward, last_conversion",
      )
      .eq("id", userId)
      .maybeSingle();

    if (error || !data) return null;
    return {
      balance_pitecoin: Number(data.balance_pitecoin ?? 0),
      xp_total: Number(data.xp_total ?? 0),
      pts_weekly: Number(data.pts_weekly ?? 0),
      level: Number(data.level ?? 0),
      current_streak: Number(data.current_streak ?? 0),
      best_streak: Number(data.best_streak ?? 0),
      last_daily_reward: data.last_daily_reward ?? null,
      last_conversion: data.last_conversion ?? null,
    };
  } catch (error) {
    console.error("[PiteCOIN] Failed to load economy profile:", error);
    return null;
  }
}

export function getNextConversionDate(): Date {
  const now = new Date();
  const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  sp.setDate(sp.getDate() + ((7 - sp.getDay()) % 7 || 7));
  sp.setHours(23, 59, 0, 0);
  return sp;
}

export function formatPitecoin(amount: number): string {
  return `₱${amount}`;
}
