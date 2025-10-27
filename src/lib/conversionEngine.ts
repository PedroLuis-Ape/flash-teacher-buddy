/**
 * Conversion Engine - Weekly PTS → PITECOIN conversion
 */

import { supabase } from "@/integrations/supabase/client";
import { FEATURE_FLAGS } from "./featureFlags";

interface ConversionResult {
  success: boolean;
  ptsConverted: number;
  pitecoinAwarded: number;
  streakBonus: number;
}

/**
 * Get week start/end dates for a given date
 */
function getWeekBounds(date: Date): { start: string; end: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; // Monday as start of week
  
  const start = new Date(d.setDate(diff));
  start.setHours(0, 0, 0, 0);
  
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

/**
 * Calculate streak bonus percentage
 */
function calculateStreakBonus(streakWeeks: number): number {
  // +10% per consecutive week >= 500 PTS (max +30%)
  return Math.min(streakWeeks * 10, 30);
}

/**
 * Perform weekly PTS → PITECOIN conversion
 * Idempotent - will not duplicate conversions
 */
export async function performWeeklyConversion(userId: string): Promise<ConversionResult> {
  if (!FEATURE_FLAGS.economy_enabled || !FEATURE_FLAGS.conversion_cron_enabled) {
    return { success: false, ptsConverted: 0, pitecoinAwarded: 0, streakBonus: 0 };
  }

  try {
    const now = new Date();
    const { start: weekStart, end: weekEnd } = getWeekBounds(now);

    // Check if already converted this week
    const { data: existing } = await supabase
      .from('conversion_history')
      .select('id')
      .eq('user_id', userId)
      .eq('week_start', weekStart)
      .maybeSingle();

    if (existing) {
      console.log('[ConversionEngine] Already converted this week');
      return { success: false, ptsConverted: 0, pitecoinAwarded: 0, streakBonus: 0 };
    }

    // Get user's current PTS
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('pts_weekly, balance_pitecoin')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;
    if (!profile || profile.pts_weekly === 0) {
      console.log('[ConversionEngine] No PTS to convert');
      return { success: false, ptsConverted: 0, pitecoinAwarded: 0, streakBonus: 0 };
    }

    // Calculate streak (count consecutive weeks with >= 500 PTS)
    const { data: history } = await supabase
      .from('conversion_history')
      .select('pts_converted')
      .eq('user_id', userId)
      .order('week_start', { ascending: false })
      .limit(4); // Last 4 weeks max (30% bonus)

    let streakWeeks = 0;
    if (history) {
      for (const record of history) {
        if (record.pts_converted >= 500) {
          streakWeeks++;
        } else {
          break;
        }
      }
    }

    // Conversion formula
    const ptsConverted = Math.min(1500, profile.pts_weekly);
    const baseAmount = ptsConverted / 10;
    const streakBonusPct = calculateStreakBonus(streakWeeks);
    const streakBonusAmount = baseAmount * (streakBonusPct / 100);
    const totalAwarded = Math.min(200, Math.floor(baseAmount + streakBonusAmount));

    const newBalance = profile.balance_pitecoin + totalAwarded;

    // Update profile
    await supabase
      .from('profiles')
      .update({
        pts_weekly: 0,
        balance_pitecoin: newBalance,
        last_conversion: now.toISOString(),
      })
      .eq('id', userId);

    // Log transaction
    await supabase
      .from('pitecoin_transactions')
      .insert({
        user_id: userId,
        amount: totalAwarded,
        balance_after: newBalance,
        type: 'earn',
        source: `Conversão semanal (${ptsConverted} PTS${streakBonusPct > 0 ? ` +${streakBonusPct}% bônus` : ''})`,
      });

    // Log conversion history
    await supabase
      .from('conversion_history')
      .insert({
        user_id: userId,
        week_start: weekStart,
        week_end: weekEnd,
        pts_converted: ptsConverted,
        pitecoin_awarded: totalAwarded,
        streak_weeks: streakWeeks,
        streak_bonus_pct: streakBonusPct,
      });

    return {
      success: true,
      ptsConverted,
      pitecoinAwarded: totalAwarded,
      streakBonus: streakBonusPct,
    };
  } catch (error) {
    console.error('[ConversionEngine] Error during conversion:', error);
    return { success: false, ptsConverted: 0, pitecoinAwarded: 0, streakBonus: 0 };
  }
}

/**
 * Check if conversion is due and perform it
 * Can be called on app init or manually
 */
export async function checkAndPerformConversion(userId: string): Promise<ConversionResult> {
  if (!FEATURE_FLAGS.conversion_cron_enabled) {
    return { success: false, ptsConverted: 0, pitecoinAwarded: 0, streakBonus: 0 };
  }

  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('last_conversion')
      .eq('id', userId)
      .single();

    if (!profile) return { success: false, ptsConverted: 0, pitecoinAwarded: 0, streakBonus: 0 };

    const now = new Date();
    const lastConversion = profile.last_conversion ? new Date(profile.last_conversion) : null;

    // Check if a week has passed since last conversion
    if (lastConversion) {
      const daysSinceConversion = Math.floor((now.getTime() - lastConversion.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceConversion < 7) {
        return { success: false, ptsConverted: 0, pitecoinAwarded: 0, streakBonus: 0 };
      }
    }

    return await performWeeklyConversion(userId);
  } catch (error) {
    console.error('[ConversionEngine] Error checking conversion:', error);
    return { success: false, ptsConverted: 0, pitecoinAwarded: 0, streakBonus: 0 };
  }
}
