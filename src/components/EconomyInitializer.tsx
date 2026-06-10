/**
 * EconomyInitializer - Runs economy checks on app init
 * - Checks for daily login bonus
 * - Performs missed weekly conversions
 */

import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { checkDailyLogin } from "@/lib/rewardEngine";
import { checkAndPerformConversion } from "@/lib/conversionEngine";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { isSafeModeEnabled } from "@/lib/safeMode";
import { toast } from "sonner";

export function EconomyInitializer() {
  useEffect(() => {
    if (!FEATURE_FLAGS.economy_enabled) return;
    if (isSafeModeEnabled()) return;

    // Skip on public/auth routes — economy work is only meaningful for
    // authenticated users inside the app shell.
    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (path.startsWith("/auth") || path.startsWith("/portal")) return;

    // Defer economy init by 3s so it never competes with critical boot paths
    const delayTimer = setTimeout(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Check daily login (silent)
        const gotBonus = await checkDailyLogin(session.user.id);
        if (gotBonus) {
          toast.success("🎉 Bônus de login diário recebido!");
        }

        // Check and perform missed conversion (silent unless it happens)
        if (FEATURE_FLAGS.conversion_cron_enabled) {
          const result = await checkAndPerformConversion(session.user.id);
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
  }, []);

  return null; // This component only runs side effects
}
