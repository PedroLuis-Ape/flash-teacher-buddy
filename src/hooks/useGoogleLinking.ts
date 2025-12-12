import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Increment this when you want to show the prompt again to all users
export const GOOGLE_CONNECT_PROMPT_VERSION = 1;

interface GoogleLinkingState {
  isGoogleConnected: boolean;
  loading: boolean;
  shouldShowPrompt: boolean;
  promptLoading: boolean;
}

export function useGoogleLinking() {
  const [state, setState] = useState<GoogleLinkingState>({
    isGoogleConnected: false,
    loading: true,
    shouldShowPrompt: false,
    promptLoading: true,
  });

  // Check if user has Google identity connected
  const checkGoogleConnection = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getUserIdentities();
      if (error) {
        console.error("[useGoogleLinking] Error getting identities:", error);
        return false;
      }
      
      const hasGoogle = data?.identities?.some(
        (identity) => identity.provider === "google"
      ) ?? false;
      
      return hasGoogle;
    } catch (error) {
      console.error("[useGoogleLinking] Error checking Google:", error);
      return false;
    }
  }, []);

  // Check if should show prompt (for existing users)
  const checkShouldShowPrompt = useCallback(async (userId: string, hasGoogle: boolean) => {
    if (hasGoogle) {
      return false;
    }

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("google_connect_prompt_version_seen, google_connect_prompt_dont_show")
        .eq("id", userId)
        .single();

      if (error) {
        console.error("[useGoogleLinking] Error fetching profile:", error);
        return false;
      }

      const versionSeen = profile?.google_connect_prompt_version_seen ?? 0;
      const dontShow = profile?.google_connect_prompt_dont_show ?? false;

      // Show prompt if: not connected, not dismissed forever, and hasn't seen this version
      return !dontShow && versionSeen < GOOGLE_CONNECT_PROMPT_VERSION;
    } catch (error) {
      console.error("[useGoogleLinking] Error:", error);
      return false;
    }
  }, []);

  // Mark prompt as seen (called when popup opens)
  const markPromptAsSeen = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase
        .from("profiles")
        .update({ google_connect_prompt_version_seen: GOOGLE_CONNECT_PROMPT_VERSION })
        .eq("id", session.user.id);
    } catch (error) {
      console.error("[useGoogleLinking] Error marking as seen:", error);
    }
  }, []);

  // Mark as "don't show again"
  const markDontShowAgain = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase
        .from("profiles")
        .update({ 
          google_connect_prompt_dont_show: true,
          google_connect_prompt_version_seen: GOOGLE_CONNECT_PROMPT_VERSION 
        })
        .eq("id", session.user.id);

      setState(prev => ({ ...prev, shouldShowPrompt: false }));
    } catch (error) {
      console.error("[useGoogleLinking] Error setting dont show:", error);
    }
  }, []);

  // Connect Google account (link identity)
  const connectGoogle = useCallback(async () => {
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        if (error.message?.includes("already linked") || error.message?.includes("already exists")) {
          toast.error("Este Google já está conectado a outra conta.");
        } else if (error.message?.includes("not allowed") || error.message?.includes("manual linking")) {
          toast.error("Configuração do servidor: linking não habilitado.");
        } else {
          toast.error(error.message || "Erro ao conectar Google");
        }
        return false;
      }
      
      // Redirect will happen automatically
      return true;
    } catch (error: any) {
      console.error("[useGoogleLinking] Error linking Google:", error);
      toast.error("Erro ao conectar Google. Tente novamente.");
      return false;
    }
  }, []);

  // Disconnect Google account
  const disconnectGoogle = useCallback(async () => {
    try {
      const { data: identitiesData, error: identitiesError } = await supabase.auth.getUserIdentities();
      
      if (identitiesError) {
        toast.error("Erro ao buscar identidades");
        return false;
      }

      const identities = identitiesData?.identities ?? [];
      
      // Must have at least 2 identities to unlink one
      if (identities.length < 2) {
        toast.error("Não é possível desconectar. Você precisa de pelo menos outra forma de login.");
        return false;
      }

      const googleIdentity = identities.find(i => i.provider === "google");
      if (!googleIdentity) {
        toast.error("Conta Google não encontrada");
        return false;
      }

      const { error } = await supabase.auth.unlinkIdentity(googleIdentity);
      
      if (error) {
        toast.error(error.message || "Erro ao desconectar Google");
        return false;
      }

      // Update state and clear google_connected_at
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from("profiles")
          .update({ google_connected_at: null })
          .eq("id", session.user.id);
      }

      setState(prev => ({ ...prev, isGoogleConnected: false }));
      toast.success("Google desconectado com sucesso!");
      return true;
    } catch (error: any) {
      console.error("[useGoogleLinking] Error unlinking:", error);
      toast.error("Erro ao desconectar Google");
      return false;
    }
  }, []);

  // Update google_connected_at when Google is connected
  const updateGoogleConnectedAt = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      await supabase
        .from("profiles")
        .update({ google_connected_at: new Date().toISOString() })
        .eq("id", session.user.id);
    } catch (error) {
      console.error("[useGoogleLinking] Error updating connected_at:", error);
    }
  }, []);

  // Initialize state
  const initialize = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      setState({
        isGoogleConnected: false,
        loading: false,
        shouldShowPrompt: false,
        promptLoading: false,
      });
      return;
    }

    const hasGoogle = await checkGoogleConnection();
    const shouldShow = await checkShouldShowPrompt(session.user.id, hasGoogle);

    setState({
      isGoogleConnected: hasGoogle,
      loading: false,
      shouldShowPrompt: shouldShow,
      promptLoading: false,
    });
  }, [checkGoogleConnection, checkShouldShowPrompt]);

  // Refresh Google connection status
  const refresh = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    const hasGoogle = await checkGoogleConnection();
    setState(prev => ({ 
      ...prev, 
      isGoogleConnected: hasGoogle, 
      loading: false,
      shouldShowPrompt: false, // After checking, don't show prompt
    }));
    return hasGoogle;
  }, [checkGoogleConnection]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  return {
    ...state,
    connectGoogle,
    disconnectGoogle,
    markPromptAsSeen,
    markDontShowAgain,
    refresh,
    updateGoogleConnectedAt,
  };
}
