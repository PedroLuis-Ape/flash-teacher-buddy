/**
 * EconomyInitializer - prepares the authenticated user's economy state.
 *
 * Daily/streak rewards are granted by the server when the first valid study
 * session is settled. This initializer must never mint a separate client-side
 * login reward.
 */

import { useEffect, useRef } from "react";
import { getEconomyProfile } from "@/lib/rewardEngine";
import { checkAndPerformConversion } from "@/lib/conversionEngine";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { isSafeModeEnabled } from "@/lib/safeMode";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function EconomyInitializer() {
  const { status, userId } = useAuth();
  const ranForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!FEATURE_FLAGS.economy_enabled || isSafeModeEnabled()) return;
    if (status !== "authenticated" || !userId) return;
    if (ranForRef.current === userId) return;

    const path = typeof window !== "undefined" ? window.location.pathname : "";
    if (path.startsWith("/auth") || path.startsWith("/portal")) return;

    ranForRef.current = userId;

    const delayTimer = setTimeout(async () => {
      try {
        // Creates/repairs the economy profile through the canonical server RPC.
        await getEconomyProfile(userId);

        // Automatic conversion remains opt-in. Manual exchange is available in
        // the store and is the default production behavior.
        if (FEATURE_FLAGS.conversion_cron_enabled) {
          const result = await checkAndPerformConversion(userId);
          if (result.success) {
            window.dispatchEvent(new CustomEvent("pitecoin:changed"));
            toast.success(
              `💰 Conversão semanal concluída! +₱${result.pitecoinAwarded}`,
              { duration: 5000 },
            );
          }
        }
      } catch (error) {
        console.error("[EconomyInitializer] Error:", error);
      }
    }, 3000);

    return () => clearTimeout(delayTimer);
  }, [status, userId]);

  return null;
}
