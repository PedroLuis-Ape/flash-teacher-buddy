import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const AuthCallback = () => {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Processando autenticação...");

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the session - Supabase handles the OAuth callback automatically
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("[AuthCallback] Session error:", error);
          toast.error("Erro na autenticação. Tente novamente.");
          navigate("/auth", { replace: true });
          return;
        }

        if (session) {
          // Check if this was a link identity operation (Google connect)
          const { data: identitiesData } = await supabase.auth.getUserIdentities();
          const hasGoogle = identitiesData?.identities?.some(i => i.provider === "google") ?? false;

          if (hasGoogle) {
            // Update google_connected_at in profile
            await supabase
              .from("profiles")
              .update({ google_connected_at: new Date().toISOString() })
              .eq("id", session.user.id);

            toast.success("Google conectado com sucesso! 🎉");
          } else {
            // Regular login success
            const { data: profile } = await supabase
              .from("profiles")
              .select("first_name")
              .eq("id", session.user.id)
              .maybeSingle();

            toast.success(`Bem-vindo${profile?.first_name ? `, ${profile.first_name}` : ""}!`);
          }

          setMessage("Redirecionando...");
          navigate("/", { replace: true });
        } else {
          // No session, redirect to auth
          navigate("/auth", { replace: true });
        }
      } catch (error) {
        console.error("[AuthCallback] Error:", error);
        toast.error("Erro inesperado. Tente novamente.");
        navigate("/auth", { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoadingSpinner message={message} />
    </div>
  );
};

export default AuthCallback;
