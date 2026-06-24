import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TurmaEngagementConfig {
  listId?: string;
  mode: string;
}

interface EngagementContext {
  turmaId: string;
  assignmentId: string | null;
}

type EngagementEvent = "open" | "card_view" | "answer" | "complete";

const VISITOR_STORAGE_KEY = "ape-turma-visitor-v1";

function randomToken(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

function readOrCreateVisitorToken(): string {
  if (typeof window === "undefined") return randomToken();
  try {
    const existing = window.localStorage.getItem(VISITOR_STORAGE_KEY);
    if (existing && existing.length >= 16) return existing;
    const created = randomToken();
    window.localStorage.setItem(VISITOR_STORAGE_KEY, created);
    return created;
  } catch {
    return randomToken();
  }
}

/**
 * Records a lightweight, privacy-preserving classroom trail.
 *
 * - Signed-in users are associated through auth.uid() inside the RPC.
 * - Guests use a random browser token; the database stores only its SHA-256 hash.
 * - Non-classroom lists are ignored silently.
 */
export function useTurmaEngagementTracking({ listId, mode }: TurmaEngagementConfig) {
  const sessionTokenRef = useRef(randomToken());
  const visitorTokenRef = useRef(readOrCreateVisitorToken());
  const contextPromiseRef = useRef<Promise<EngagementContext | null> | null>(null);
  const viewedKeysRef = useRef(new Set<string>());
  const completedRef = useRef(false);
  const unavailableLoggedRef = useRef(false);

  const resolveContext = useCallback(async (): Promise<EngagementContext | null> => {
    if (!listId) return null;
    if (contextPromiseRef.current) return contextPromiseRef.current;

    contextPromiseRef.current = (async () => {
      if (typeof window !== "undefined") {
        const params = new URLSearchParams(window.location.search);
        const turmaId = params.get("turma");
        if (turmaId) {
          return {
            turmaId,
            assignmentId: params.get("atribuicao"),
          };
        }
      }

      const { data, error } = await supabase
        .from("lists")
        .select("class_id, folder_id, folders(class_id)")
        .eq("id", listId)
        .maybeSingle();

      if (error) throw error;
      const directClassId = data?.class_id ?? null;
      const folderClassId = (data?.folders as { class_id?: string | null } | null)?.class_id ?? null;
      const turmaId = directClassId || folderClassId;
      return turmaId ? { turmaId, assignmentId: null } : null;
    })().catch((error) => {
      contextPromiseRef.current = null;
      if (import.meta.env.DEV) {
        console.debug("[turma-engagement] classroom context unavailable", error);
      }
      return null;
    });

    return contextPromiseRef.current;
  }, [listId]);

  const sendEvent = useCallback(async (
    eventType: EngagementEvent,
    cardId?: string,
    correct?: boolean,
  ) => {
    if (!listId) return;
    const context = await resolveContext();
    if (!context) return;

    const { error } = await (supabase as any).rpc("record_turma_engagement_v1", {
      _turma_id: context.turmaId,
      _list_id: listId,
      _session_token: sessionTokenRef.current,
      _visitor_token: visitorTokenRef.current,
      _event_type: eventType,
      _mode: mode,
      _card_id: cardId ?? null,
      _correct: correct ?? null,
      _atribuicao_id: context.assignmentId,
    });

    if (error && import.meta.env.DEV && !unavailableLoggedRef.current) {
      unavailableLoggedRef.current = true;
      console.debug("[turma-engagement] telemetry unavailable", error);
    }
  }, [listId, mode, resolveContext]);

  useEffect(() => {
    sessionTokenRef.current = randomToken();
    contextPromiseRef.current = null;
    viewedKeysRef.current.clear();
    completedRef.current = false;
    unavailableLoggedRef.current = false;
    if (listId) void sendEvent("open");
  }, [listId, sendEvent]);

  const trackCardViewed = useCallback((cardId: string | undefined, viewKey: string) => {
    if (!cardId) return;
    const key = `${cardId}:${viewKey}`;
    if (viewedKeysRef.current.has(key)) return;
    viewedKeysRef.current.add(key);
    void sendEvent("card_view", cardId);
  }, [sendEvent]);

  const trackAnswer = useCallback((cardId: string, correct: boolean, skipped = false) => {
    if (!cardId || skipped) return;
    void sendEvent("answer", cardId, correct);
  }, [sendEvent]);

  const trackCompleted = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    void sendEvent("complete");
  }, [sendEvent]);

  return { trackCardViewed, trackAnswer, trackCompleted };
}
