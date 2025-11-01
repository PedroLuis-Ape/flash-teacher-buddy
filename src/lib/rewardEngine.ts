/**
 * Reward Engine - Handles PTS, XP, and PITECOIN logic
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
  MAX_STREAK_BONUS: 35, // 7 days × 5
  DAILY_CAP: 500, // PTS cap per day
  CONVERSION_RATE: 100, // 100 PTS => 1 PITECOIN
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

/**
 * Award PTS and XP to user
 * Respects daily cap for PTS (but XP always increases)
 */
export async function awardPoints(
  userId: string,
  ptsAmount: number,
  source: string
): Promise<{ success: boolean; ptsAwarded: number; xpAwarded: number }> {
  if (!FEATURE_FLAGS.economy_enabled) {
    return { success: false, ptsAwarded: 0, xpAwarded: 0 };
  }

  try {
    const today = new Date().toISOString().split('T')[0];

    // Get or create today's activity record
    const { data: activity, error: activityError } = await supabase
      .from('daily_activity')
      .select('*')
      .eq('user_id', userId)
      .eq('activity_date', today)
      .maybeSingle();

    if (activityError && activityError.code !== 'PGRST116') throw activityError;

    const currentPts = activity?.pts_earned || 0;
    const cappedPts = Math.min(ptsAmount, Math.max(0, REWARD_AMOUNTS.DAILY_CAP - currentPts));
    const xpAwarded = ptsAmount; // XP always increases

    if (cappedPts === 0 && currentPts >= REWARD_AMOUNTS.DAILY_CAP) {
      // Cap reached, only award XP
      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('xp_total')
        .eq('id', userId)
        .single();

      if (currentProfile) {
        await supabase
          .from('profiles')
          .update({
            xp_total: (currentProfile.xp_total || 0) + xpAwarded,
          })
          .eq('id', userId);
      }

      return { success: true, ptsAwarded: 0, xpAwarded };
    }

    // Update daily activity
    if (activity) {
      await supabase
        .from('daily_activity')
        .update({
          pts_earned: currentPts + cappedPts,
          actions_count: (activity.actions_count || 0) + 1,
        })
        .eq('id', activity.id);
    } else {
      await supabase
        .from('daily_activity')
        .insert({
          user_id: userId,
          activity_date: today,
          pts_earned: cappedPts,
          actions_count: 1,
        });
    }

    // Update profile (fetch current values first to increment properly)
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('pts_weekly, xp_total')
      .eq('id', userId)
      .single();

    if (currentProfile) {
      await supabase
        .from('profiles')
        .update({
          pts_weekly: (currentProfile.pts_weekly || 0) + cappedPts,
          xp_total: (currentProfile.xp_total || 0) + xpAwarded,
        })
        .eq('id', userId);
    }

    return { success: true, ptsAwarded: cappedPts, xpAwarded };
  } catch (error) {
    console.error('[RewardEngine] Error awarding points:', error);
    return { success: false, ptsAwarded: 0, xpAwarded: 0 };
  }
}

/**
 * Convert points to PITECOIN automatically
 */
export async function convertPointsIfNeeded(userId: string): Promise<void> {
  if (!FEATURE_FLAGS.economy_enabled) return;

  try {
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

    // Update profile
    await supabase
      .from('profiles')
      .update({
        pts_weekly: remainingPts,
        balance_pitecoin: newBalance,
      })
      .eq('id', userId);

    // Log transaction
    await supabase.from('pitecoin_transactions').insert({
      user_id: userId,
      amount: pitecoinToAdd,
      balance_after: newBalance,
      type: 'conversion',
      source: 'auto_convert'
    });
  } catch (err) {
    console.error('[RewardEngine] Error converting points:', err);
  }
}

/**
 * Check and award daily login bonus
 */
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

    if (lastReward === today) return false; // Already claimed today

    // Check if streak continues
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const streakContinues = lastReward === yesterdayStr;

    const newStreak = streakContinues ? profile.current_streak + 1 : 1;
    const streakBonus = Math.min(newStreak - 1, 7) * REWARD_AMOUNTS.STREAK_DAILY;

    // Award daily login + streak bonus
    await awardPoints(userId, REWARD_AMOUNTS.DAILY_LOGIN + streakBonus, 'Daily login');

    // Update streak
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

/**
 * Get user's economy profile
 */
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

/**
 * Calculate next conversion date (Sunday 23:59 São Paulo time)
 */
export function getNextConversionDate(): Date {
  const now = new Date();
  const spTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  
  const daysUntilSunday = (7 - spTime.getDay()) % 7 || 7;
  const nextSunday = new Date(spTime);
  nextSunday.setDate(spTime.getDate() + daysUntilSunday);
  nextSunday.setHours(23, 59, 0, 0);
  
  return nextSunday;
}

/**
 * Format PITECOIN amount with symbol
 */
export function formatPitecoin(amount: number): string {
  return `₱${amount}`;
}
