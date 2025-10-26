import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const Index = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const ready = sessionStorage.getItem('authReady') === '1';
        const logoutFlag = !!sessionStorage.getItem('logoutInProgress');
        
        if (!ready || logoutFlag) {
          return false;
        }
        
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          navigate('/folders', { replace: true });
        } else {
          navigate('/auth', { replace: true });
        }
        
        setIsChecking(false);
        return true;
      } catch (error) {
        console.error("[Index] Erro ao verificar sessão:", error);
        navigate('/auth', { replace: true });
        setIsChecking(false);
        return true;
      }
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

  if (!isChecking) {
    return null; // Já redirecionou
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <LoadingSpinner message="Carregando..." />
    </div>
  );
};

export default Index;
