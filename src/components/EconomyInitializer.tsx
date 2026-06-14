/**
 * EconomyInitializer - Runs economy checks on app init
 * - Checks for daily login bonus
 * - Performs missed weekly conversions
 */

import { useEffect, useRef } from "react";
import { checkDailyLogin } from "@/lib/rewardEngine";
import { checkAndPerformConversion } from "@/lib/conversionEngine";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { isSafeModeEnabled } from "@/lib/safeMode";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function EconomyInitializer() {
  const { status, userId } = useAuth();
  // Guard against double-execution per session (StrictMode / re-mount).
  const ranForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!FEATURE_FLAGS.economy_enabled) return;
    if (isSafeModeEnabled()) return;
    // Wait for a confirmed authenticated user — never run on optimistic state.
    if (status !== "authenticated" || !userId) return;
    if (ranForRef.current === userId) return;

    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (path.startsWith("/auth") || path.startsWith("/portal")) return;

    ranForRef.current = userId;

    // Defer economy init by 3s so it never competes with critical boot paths
    const delayTimer = setTimeout(async () => {
      try {
        const gotBonus = await checkDailyLogin(userId);
        if (gotBonus) {
          toast.success("🎉 Bônus de login diário recebido!");
        }

        // Check and perform missed conversion (silent unless it happens)
        if (FEATURE_FLAGS.conversion_cron_enabled) {
          const result = await checkAndPerformConversion(userId);
          if (result.success) {
            toast.success(
              `💰 Conversão semanal concluída! +₱${result.pitecoinAwarded}`,
              { duration: 5000 }
            );
          }
        }
      } catch (error) {
        console.error('[EconomyInitializer] Error:', error);
      }
    }, 3000);

    return () => clearTimeout(delayTimer);
  }, [status, userId]);

  return null; // This component only runs side effects
}
