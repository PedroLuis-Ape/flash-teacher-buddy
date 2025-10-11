import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(async () => {
      const ready = sessionStorage.getItem('authReady') === '1';
      const logoutFlag = !!sessionStorage.getItem('logoutInProgress');
      if (!ready || logoutFlag) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/folders', { replace: true });
      }
      // Se não houver sessão, a guarda global cuidará do redirecionamento para /auth
    }, 400);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  );
};

export default Index;
