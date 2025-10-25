import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkSession = async () => {
      const ready = sessionStorage.getItem('authReady') === '1';
      const logoutFlag = !!sessionStorage.getItem('logoutInProgress');
      if (!ready || logoutFlag) return false;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/folders', { replace: true });
        return true;
      }
      // Se não houver sessão, a guarda global cuidará do redirecionamento para /auth
      return true;
    };
    
    // Verificar imediatamente e depois em intervalos até authReady estar pronto
    let intervalId: number;
    const startChecking = async () => {
      const done = await checkSession();
      if (!done) {
        intervalId = window.setInterval(checkSession, 100);
      }
    };
    startChecking();
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  );
};

export default Index;
