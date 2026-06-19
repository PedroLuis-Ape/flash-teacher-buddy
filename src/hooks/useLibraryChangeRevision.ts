import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Emits a small revision number whenever folders, lists or flashcards change.
 * Consumers can use it as a React key to reload their already-established
 * aggregate loaders without duplicating counting logic.
 *
 * Realtime is the primary path. Focus/visibility and a low-frequency timer are
 * fallbacks for browsers that suspended the socket or projects where a table
 * is temporarily absent from the realtime publication.
 */
export function useLibraryChangeRevision(): number {
  const { userId, status } = useAuth();
  const [revision, setRevision] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setRevision((value) => value + 1);
      debounceRef.current = null;
    }, 450);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !userId) return;

    const channel = supabase
      .channel(`library-counts:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "folders", filter: `owner_id=eq.${userId}` },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "lists", filter: `owner_id=eq.${userId}` },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "flashcards", filter: `user_id=eq.${userId}` },
        scheduleRefresh,
      )
      .subscribe();

    const handleFocus = () => scheduleRefresh();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    const fallbackInterval = window.setInterval(() => {
      if (document.visibilityState === "visible") scheduleRefresh();
    }, 30_000);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      window.clearInterval(fallbackInterval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      void supabase.removeChannel(channel);
    };
  }, [scheduleRefresh, status, userId]);

  return revision;
}
