/**
 * APE – Apprentice Practice & Enhancement
 * © 2025 Pedro Luis de Oliveira Silva. Todos os direitos reservados.
 */

import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

const HEARTBEAT_INTERVAL_MS = 60 * 1000; // 60 seconds

/**
 * Hook that sends periodic heartbeat updates to track user activity.
 * This updates the last_active_at field in the profiles table.
 * 
 * @param userId - The user ID to update activity for
 */
export function useActivityHeartbeat(userId: string | undefined) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastUpdateRef = useRef<number>(0);

  useEffect(() => {
    if (!userId) return;

    const updateActivity = async () => {
      const now = Date.now();
      // Prevent updates more frequent than 30 seconds
      if (now - lastUpdateRef.current < 30000) return;
      
      lastUpdateRef.current = now;
      
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", userId);
        
        if (error) {
          console.error("[Heartbeat] Error updating activity:", error.message);
        }
      } catch (err) {
        console.error("[Heartbeat] Unexpected error:", err);
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
