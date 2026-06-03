/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 APE Education. Todos os direitos reservados.
 */

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { isSafeModeEnabled } from "@/lib/safeMode";

const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 60 seconds
const CALL_TIMEOUT_MS = 7000;

/**
 * Hook that sends periodic heartbeat updates to track user activity.
 * This updates the last_active_at field in the profiles table.
 * Respects FEATURE_FLAGS.heartbeat_enabled for safe mode.
 */
export function useActivityHeartbeat(userId: string | undefined) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);
  const inFlightRef = useRef<boolean>(false);

  useEffect(() => {
    if (!userId || !FEATURE_FLAGS.heartbeat_enabled) return;
    if (isSafeModeEnabled()) return;

    const updateActivity = async () => {
      // Skip if a previous call hasn't completed.
      if (inFlightRef.current) return;
      // Only run when the tab is visible.
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

      const now = Date.now();
      // Prevent updates more frequent than 30 seconds
      if (now - lastUpdateRef.current < 30000) return;

      lastUpdateRef.current = now;
      inFlightRef.current = true;

      const timeoutPromise = new Promise<{ error: { message: string } }>((resolve) =>
        setTimeout(() => resolve({ error: { message: "heartbeat timeout" } }), CALL_TIMEOUT_MS)
      );

      try {
        const call = supabase.rpc('update_own_profile', {
          p_user_id: userId,
          p_last_active_at: new Date().toISOString()
        });
        const result: any = await Promise.race([call, timeoutPromise]);
        const error = result?.error;

        if (error) {
          console.warn("[Heartbeat] update skipped:", error.message);
        }
      } catch (err) {
        console.warn("[Heartbeat] Unexpected error:", err);
      } finally {
        inFlightRef.current = false;
      }
    };

    // Initial update on mount
    updateActivity();

    // Set up interval for periodic updates
    intervalRef.current = setInterval(updateActivity, HEARTBEAT_INTERVAL_MS);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [userId]);
}
