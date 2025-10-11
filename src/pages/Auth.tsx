import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PitecoMascot } from "@/components/PitecoMascot";
import { PitecoLogo } from "@/components/PitecoLogo";
import { toast } from "sonner";

const OWNER_EMAIL = import.meta.env.VITE_OWNER_EMAIL || "";
const OWNER_FIRST_NAME = import.meta.env.VITE_OWNER_FIRST_NAME || "Professor";

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoutJustOccurred, setLogoutJustOccurred] = useState(false);

  useEffect(() => {
    // Detecta logout via flag ou query e limpa a flag imediatamente ao carregar /auth
    const params = new URLSearchParams(window.location.search);
    const queryLogout = params.get('logout') === '1';
    const flagLogout = !!sessionStorage.getItem('logoutInProgress');
    if (queryLogout || flagLogout) {
      setLogoutJustOccurred(true);
    }
    // Limpa a flag e remove o parâmetro da URL
    sessionStorage.removeItem('logoutInProgress');
    if (queryLogout) {
      params.delete('logout');
      const url = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, '', url);
    }
  }, []);

  useEffect(() => {
    // Debounce para evitar ler sessão antiga do storage
    const timer = setTimeout(async () => {
      const authReady = sessionStorage.getItem('authReady') === '1';
      if (!authReady || logoutJustOccurred) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/', { replace: true });
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [navigate, logoutJustOccurred]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (email.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
      toast.error("Apenas o professor pode fazer login nesta área.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (!profile) {
          await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              email: data.user.email,
              first_name: OWNER_FIRST_NAME,
              role: 'owner',
              is_primary: true,
            });
        } else {
          await supabase
            .from('profiles')
            .update({
              role: 'owner',
              is_primary: true,
              first_name: profile.first_name || OWNER_FIRST_NAME,
            })
            .eq('id', data.user.id);
        }

        toast.success(`Bem-vindo, ${OWNER_FIRST_NAME}!`);
        navigate("/");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-accent flex items-center justify-center p-4 relative overflow-hidden">
      <PitecoMascot />
      
      <div className="w-full max-w-md space-y-6 relative z-20">
        <Card className="p-6 shadow-[var(--shadow-card)] bg-card/95 backdrop-blur">
          <div className="flex flex-col items-center text-center">
            <PitecoLogo className="h-24 w-24 mb-4" />
            <h1 className="text-4xl font-bold mb-2">Bem-vindo à APE! 🎓</h1>
            <p className="text-muted-foreground text-lg">
              Apprenticeship Practice and Enhancement
            </p>
          </div>
        </Card>

        <Card className="p-6 shadow-[var(--shadow-card)] bg-card/95 backdrop-blur hover:shadow-xl transition-shadow">
          <h2 className="text-2xl font-bold text-center mb-2">Modo Aluno</h2>
          <p className="text-center text-muted-foreground mb-4">
            Acesse o material de estudo
          </p>
          <Button 
            className="w-full" 
            size="lg"
            onClick={() => navigate("/portal")}
          >
            Acessar como Aluno
          </Button>
        </Card>

        <Card className="w-full max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">Acesso do Professor</CardTitle>
            <CardDescription>Entre com suas credenciais</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignIn} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
