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
        const flow = new URLSearchParams(window.location.search).get("flow");
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("[AuthCallback] Session error:", error);
          toast.error("Erro na autenticação. Tente novamente.");
          navigate("/auth", { replace: true });
          return;
        }

        if (!session) {
          navigate("/auth", { replace: true });
          return;
        }

        setMessage("Concluindo seu perfil...");
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("first_name, is_teacher, public_slug")
          .eq("id", session.user.id)
          .maybeSingle();

        if (profileError) throw profileError;
        if (!profile) {
          throw new Error("Sua conta foi confirmada, mas o perfil ainda não foi criado.");
        }

        if (flow === "link-google") {
          await supabase.rpc("update_own_profile", {
            p_user_id: session.user.id,
            p_google_connected_at: new Date().toISOString(),
          });
          toast.success("Google conectado com sucesso! 🎉");
        } else {
          toast.success(
            flow === "signup"
              ? `Conta confirmada${profile.first_name ? `, ${profile.first_name}` : ""}!`
              : `Bem-vindo${profile.first_name ? `, ${profile.first_name}` : ""}!`,
          );
        }

        setMessage("Redirecionando...");
        const route = profile.is_teacher
          ? profile.public_slug
            ? "/painel-professor"
            : "/settings/public-profile"
          : "/dashboard";
        navigate(route, { replace: true });
      } catch (error) {
        console.error("[AuthCallback] Error:", error);
        const message = error instanceof Error ? error.message : "Erro inesperado. Tente novamente.";
        toast.error(message);
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
