import { supabase } from "@/integrations/supabase/client";
import { FEATURE_FLAGS } from "./featureFlags";

export const REWARD_AMOUNTS = {
  CORRECT_ANSWER: 5, SESSION_BONUS: 10, SESSION_BONUS_MIN_CORRECT: 10,
  SESSION_COMPLETE: 20, WEEKLY_CHALLENGE: 100, DAILY_LOGIN: 10,
  STREAK_DAILY: 5, MAX_STREAK_BONUS: 35, DAILY_CAP: 500, CONVERSION_RATE: 100,
} as const;

export interface EconomyProfile {
  balance_pitecoin: number; xp_total: number; pts_weekly: number; level: number;
  current_streak: number; best_streak: number; last_daily_reward: string | null;
  last_conversion: string | null;
}
export interface RewardResult {
  success: boolean; ptsAwarded: number; xpAwarded: number;
  pitecoinAwarded?: number; error?: string;
}

type Session = { id: string; current_index: number | null; cards_order: unknown };
const OK: RewardResult = { success: true, ptsAwarded: 0, xpAwarded: 0, pitecoinAwarded: 0 };
const FAIL: RewardResult = { success: false, ptsAwarded: 0, xpAwarded: 0, pitecoinAwarded: 0 };

async function activeSession(userId: string): Promise<Session | null> {
  const { data, error } = await supabase.from("study_sessions")
    .select("id,current_index,cards_order").eq("user_id", userId)
    .eq("completed", false).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (error) console.warn("[PiteCOIN] session:", error.message);
  return error ? null : data as Session | null;
}

async function recordCorrect(userId: string): Promise<RewardResult> {
  const session = await activeSession(userId);
  if (!session || !Array.isArray(session.cards_order) || !session.cards_order.length) return FAIL;
  const index = Math.max(0, Math.min(session.current_index ?? 0, session.cards_order.length - 1));
  const flashcardId = session.cards_order[index];
  if (typeof flashcardId !== "string") return FAIL;
  const { data, error } = await (supabase as any).rpc("ensure_piteco_profile", {
    p_session_id: session.id, p_flashcard_id: flashcardId, p_correct: true, p_skipped: false,
  });
  return !error && data?.success ? OK : FAIL;
}

async function finish(userId: string): Promise<RewardResult> {
  const session = await activeSession(userId);
  if (!session) return FAIL;
  const { data, error } = await (supabase as any).rpc("ensure_piteco_profile", {
    p_session_id: session.id, p_fill_missing: true,
  });
  if (error || !data?.success) return { ...FAIL, error: data?.error ?? error?.code };
  return {
    success: true,
    ptsAwarded: Number(data.breakdown?.pts_awarded ?? 0),
    xpAwarded: Number(data.breakdown?.xp_awarded ?? 0),
    pitecoinAwarded: Number(data.reward_amount ?? 0),
  };
}

export async function awardPoints(userId: string, amount: number, source: string): Promise<RewardResult> {
  if (!FEATURE_FLAGS.economy_enabled || !userId) return FAIL;
  const event = source.trim().toLocaleLowerCase();
  if (event.includes("flashcard_correct")) return OK;
  try {
    if (amount === REWARD_AMOUNTS.CORRECT_ANSWER && event.includes("resposta correta")) return recordCorrect(userId);
    if (amount === REWARD_AMOUNTS.SESSION_COMPLETE || event.includes("sessão completa") || event.includes("sessao completa")) return finish(userId);
    return OK;
  } catch (error) {
    console.error("[PiteCOIN]", error); return FAIL;
  }
}

export async function flushAwardQueue(_userId: string): Promise<RewardResult> { return OK; }
export function flushAllAwardQueues(): void {}
export async function convertPointsIfNeeded(_userId: string): Promise<void> {}
export async function checkDailyLogin(_userId: string): Promise<boolean> { return false; }

export async function getEconomyProfile(_userId: string): Promise<EconomyProfile | null> {
  const { data, error } = await (supabase as any).rpc("ensure_piteco_profile");
  if (error || !data?.success) return null;
  return {
    balance_pitecoin: +data.balance_pitecoin || 0, xp_total: +data.xp_total || 0,
    pts_weekly: +data.pts_weekly || 0, level: +data.level || 0,
    current_streak: +data.current_streak || 0, best_streak: +data.best_streak || 0,
    last_daily_reward: data.last_daily_reward ?? null, last_conversion: data.last_conversion ?? null,
  };
}

export function getNextConversionDate(): Date {
  const now = new Date();
  const sp = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  sp.setDate(sp.getDate() + ((7 - sp.getDay()) % 7 || 7)); sp.setHours(23, 59, 0, 0); return sp;
}
export function formatPitecoin(amount: number): string { return `₱${amount}`; }
