/**
 * Reward Engine - Handles PTS, XP, and PITECOIN logic.
 */

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

interface RewardResult {
  success: boolean;
  ptsAwarded: number;
  xpAwarded: number;
}

interface PendingReward {
  pts: number;
  actions: number;
  timer: ReturnType<typeof setTimeout> | null;
}

const pendingRewards = new Map<string, PendingReward>();
const flushChains = new Map<string, Promise<RewardResult>>();
const REWARD_FLUSH_DELAY_MS = 5000;
const REWARD_FLUSH_ACTION_THRESHOLD = 10;
const EMPTY_RESULT: RewardResult = { success: true, ptsAwarded: 0, xpAwarded: 0 };

function normalizeRewardSource(source: string): string {
  return source.trim().toLocaleLowerCase();
}

function isLegacyFlipReward(source: string): boolean {
  return normalizeRewardSource(source).includes('flashcard_correct');
}

function isCorrectAnswerReward(ptsAmount: number, source: string): boolean {
  return ptsAmount === REWARD_AMOUNTS.CORRECT_ANSWER
    && normalizeRewardSource(source).includes('resposta correta');
}

function scheduleRewardFlush(userId: string): void {
  const pending = pendingRewards.get(userId);
  if (!pending) return;
  if (pending.timer) clearTimeout(pending.timer);
  pending.timer = setTimeout(() => {
    void flushAwardQueue(userId);
  }, REWARD_FLUSH_DELAY_MS);
}

function enqueueCorrectAnswer(userId: string, ptsAmount: number): RewardResult {
  const pending = pendingRewards.get(userId) ?? { pts: 0, actions: 0, timer: null };
  pending.pts += ptsAmount;
  pending.actions += 1;
  pendingRewards.set(userId, pending);

  if (pending.actions >= REWARD_FLUSH_ACTION_THRESHOLD) {
    void flushAwardQueue(userId);
  } else {
    scheduleRewardFlush(userId);
  }

  return { success: true, ptsAwarded: ptsAmount, xpAwarded: ptsAmount };
}

async function awardPointsImmediate(
  userId: string,
  ptsAmount: number,
  source: string,
  actionsCount = 1,
): Promise<RewardResult> {
  if (!FEATURE_FLAGS.economy_enabled || ptsAmount <= 0) {
    return { success: false, ptsAwarded: 0, xpAwarded: 0 };
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: activity, error: activityError } = await supabase
      .from('daily_activity')
      .select('id, pts_earned, actions_count')
      .eq('user_id', userId)
      .eq('activity_date', today)
      .maybeSingle();

    if (activityError && activityError.code !== 'PGRST116') throw activityError;

    const currentPts = activity?.pts_earned || 0;
    const cappedPts = Math.min(ptsAmount, Math.max(0, REWARD_AMOUNTS.DAILY_CAP - currentPts));
    const xpAwarded = ptsAmount;

    if (activity) {
      const { error } = await supabase
        .from('daily_activity')
        .update({
          pts_earned: currentPts + cappedPts,
          actions_count: (activity.actions_count || 0) + actionsCount,
        })
        .eq('id', activity.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('daily_activity').insert({
        user_id: userId,
        activity_date: today,
        pts_earned: cappedPts,
        actions_count: actionsCount,
      });
      if (error) throw error;
    }

    const { data: currentProfile, error: profileError } = await supabase
      .from('profiles')
      .select('pts_weekly, xp_total')
      .eq('id', userId)
      .single();
    if (profileError) throw profileError;

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        pts_weekly: (currentProfile.pts_weekly || 0) + cappedPts,
        xp_total: (currentProfile.xp_total || 0) + xpAwarded,
      })
      .eq('id', userId);
    if (updateError) throw updateError;

    return { success: true, ptsAwarded: cappedPts, xpAwarded };
  } catch (error) {
    console.error(`[RewardEngine] Error awarding points (${source}):`, error);
    return { success: false, ptsAwarded: 0, xpAwarded: 0 };
  }
}

/**
 * Flushes queued correct-answer rewards for one user. Writes are serialized per
 * user so a slow request cannot overlap with the next batch in the same tab.
 */
export async function flushAwardQueue(userId: string): Promise<RewardResult> {
  const pending = pendingRewards.get(userId);
  if (!pending || pending.actions === 0) {
    return flushChains.get(userId) ?? EMPTY_RESULT;
  }

  if (pending.timer) clearTimeout(pending.timer);
  pendingRewards.delete(userId);

  const previous = flushChains.get(userId) ?? Promise.resolve(EMPTY_RESULT);
  const next = previous
    .catch(() => EMPTY_RESULT)
    .then(() => awardPointsImmediate(
      userId,
      pending.pts,
      'Respostas corretas (lote)',
      pending.actions,
    ));

  flushChains.set(userId, next);
  const result = await next;
  if (flushChains.get(userId) === next) flushChains.delete(userId);
  return result;
}

export function flushAllAwardQueues(): void {
  for (const userId of pendingRewards.keys()) {
    void flushAwardQueue(userId);
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushAllAwardQueues);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAllAwardQueues();
  });
}

/**
 * Correct-answer rewards are queued. Other rewards flush the queue first and
 * are then written immediately, preserving the expected order.
 */
export async function awardPoints(
  userId: string,
  ptsAmount: number,
  source: string,
): Promise<RewardResult> {
  if (!FEATURE_FLAGS.economy_enabled) {
    return { success: false, ptsAwarded: 0, xpAwarded: 0 };
  }

  // FlipStudyView historically awarded points before delegating to the central
  // study engine, which awarded the same answer again. The engine is now the
  // single source of truth; this legacy call is accepted as a no-op so older
  // component paths cannot double the user's reward.
  if (isLegacyFlipReward(source)) {
    return EMPTY_RESULT;
  }

  if (isCorrectAnswerReward(ptsAmount, source)) {
    return enqueueCorrectAnswer(userId, ptsAmount);
  }

  await flushAwardQueue(userId);
  return awardPointsImmediate(userId, ptsAmount, source);
}

export async function convertPointsIfNeeded(userId: string): Promise<void> {
  if (!FEATURE_FLAGS.economy_enabled) return;

  try {
    await flushAwardQueue(userId);
    const { data: profile } = await supabase
      .from('profiles')
      .select('pts_weekly, balance_pitecoin')
      .eq('id', userId)
      .single();

    if (!profile) return;

    const ptsToConvert = Math.floor(profile.pts_weekly / REWARD_AMOUNTS.CONVERSION_RATE) * REWARD_AMOUNTS.CONVERSION_RATE;
    if (ptsToConvert === 0) return;

    const pitecoinToAdd = ptsToConvert / REWARD_AMOUNTS.CONVERSION_RATE;
    const newBalance = profile.balance_pitecoin + pitecoinToAdd;
    const remainingPts = profile.pts_weekly - ptsToConvert;

    await supabase
      .from('profiles')
      .update({ pts_weekly: remainingPts, balance_pitecoin: newBalance })
      .eq('id', userId);

    await supabase.from('pitecoin_transactions').insert({
      user_id: userId,
      amount: pitecoinToAdd,
      balance_after: newBalance,
      type: 'conversion',
      source: 'auto_convert',
    });
  } catch (error) {
    console.error('[RewardEngine] Error converting points:', error);
  }
}

export async function checkDailyLogin(userId: string): Promise<boolean> {
  if (!FEATURE_FLAGS.economy_enabled) return false;

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('last_daily_reward, current_streak')
      .eq('id', userId)
      .single();

    if (!profile) return false;

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const lastReward = profile.last_daily_reward
      ? new Date(profile.last_daily_reward).toISOString().split('T')[0]
      : null;

    if (lastReward === today) return false;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const streakContinues = lastReward === yesterday.toISOString().split('T')[0];
    const newStreak = streakContinues ? profile.current_streak + 1 : 1;
    const streakBonus = Math.min(newStreak - 1, 7) * REWARD_AMOUNTS.STREAK_DAILY;

    await awardPoints(userId, REWARD_AMOUNTS.DAILY_LOGIN + streakBonus, 'Daily login');

    await supabase
      .from('profiles')
      .update({
        last_daily_reward: now.toISOString(),
        current_streak: newStreak,
        best_streak: Math.max(newStreak, profile.current_streak),
      })
      .eq('id', userId);

    return true;
  } catch (error) {
    console.error('[RewardEngine] Error checking daily login:', error);
    return false;
  }
}

export async function getEconomyProfile(userId: string): Promise<EconomyProfile | null> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('balance_pitecoin, xp_total, pts_weekly, level, current_streak, best_streak, last_daily_reward, last_conversion')
      .eq('id', userId)
      .single();

    if (error) throw error;
    return data as EconomyProfile;
  } catch (error) {
    console.error('[RewardEngine] Error fetching economy profile:', error);
    return null;
  }
}

export function getNextConversionDate(): Date {
  const now = new Date();
  const spTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  const daysUntilSunday = (7 - spTime.getDay()) % 7 || 7;
  const nextSunday = new Date(spTime);
  nextSunday.setDate(spTime.getDate() + daysUntilSunday);
  nextSunday.setHours(23, 59, 0, 0);
  return nextSunday;
}

export function formatPitecoin(amount: number): string {
  return `₱${amount}`;
}
