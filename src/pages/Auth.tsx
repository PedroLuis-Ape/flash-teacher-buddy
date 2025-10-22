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

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isProfessor, setIsProfessor] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  useEffect(() => {
    // Remove apenas o parâmetro de logout da URL, mas mantém a flag até novo login
    const params = new URLSearchParams(window.location.search);
    if (params.get('logout') === '1') {
      params.delete('logout');
      const url = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
      window.history.replaceState({}, '', url);
    }
  }, []);

  useEffect(() => {
    // Verificação rápida de sessão existente
    const checkSession = async () => {
      const authReady = sessionStorage.getItem('authReady') === '1';
      const logoutFlag = !!sessionStorage.getItem('logoutInProgress');
      if (!authReady || logoutFlag) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate('/', { replace: true });
      }
    };
    checkSession();
  }, [navigate]);

  // Verificar disponibilidade do username
  useEffect(() => {
    if (!isSignUp || !isProfessor || !username || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const checkUsername = async () => {
      setCheckingUsername(true);
      const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_]/g, '');
      
      const { data, error } = await supabase
        .from('profiles')
        .select('public_slug')
        .eq('public_slug', cleanUsername)
        .maybeSingle();

      setUsernameAvailable(!data && !error);
      setCheckingUsername(false);
    };

    const timer = setTimeout(checkUsername, 500);
    return () => clearTimeout(timer);
  }, [username, isSignUp, isProfessor]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // Validação do username para professores
        if (isProfessor) {
          if (!username || username.length < 3) {
            toast.error("Username deve ter pelo menos 3 caracteres");
            return;
          }
          if (usernameAvailable === false) {
            toast.error("Este username já está em uso");
            return;
          }
        }

        // Sign up
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        if (data.user) {
          const cleanUsername = isProfessor ? username.toLowerCase().replace(/[^a-z0-9_]/g, '') : null;
          
          // O trigger handle_new_user já cria o perfil básico
          // Agora apenas atualizamos os campos adicionais
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              first_name: firstName,
              public_slug: cleanUsername,
              public_access_enabled: isProfessor,
            })
            .eq('id', data.user.id);

          if (profileError) throw profileError;

          // Inserir role - o trigger assign_default_role já deve ter criado, mas garantimos aqui
          const { error: roleError } = await supabase
            .from('user_roles')
            .insert({
              user_id: data.user.id,
              role: isProfessor ? 'owner' : 'student',
            });

          // Ignorar erro se já existir (trigger já criou)
          if (roleError && !roleError.message?.includes('duplicate') && !roleError.code?.includes('23505')) {
            console.error('Erro ao criar role:', roleError);
          }

          toast.success(`Conta criada com sucesso! ${isProfessor ? `Seu @ é: @${cleanUsername}` : 'Bem-vindo!'}`);
        }
      } else {
        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          // Get user profile for welcome message
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', data.user.id)
            .maybeSingle();

          toast.success(`Bem-vindo${profile?.first_name ? `, ${profile.first_name}` : ''}!`);
        }
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

        <Card className="w-full max-w-md bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm shadow-xl">
          <CardHeader>
            <CardTitle className="text-2xl">{isSignUp ? "Criar Conta" : "Entrar"}</CardTitle>
            <CardDescription>
              {isSignUp ? "Preencha seus dados para criar uma conta" : "Entre com suas credenciais"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAuth} className="space-y-4 mt-4">
              {isSignUp && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nome</Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="Seu nome"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de conta</Label>
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant={!isProfessor ? "default" : "outline"}
                        onClick={() => setIsProfessor(false)}
                        className="flex-1"
                      >
                        Aluno
                      </Button>
                      <Button
                        type="button"
                        variant={isProfessor ? "default" : "outline"}
                        onClick={() => setIsProfessor(true)}
                        className="flex-1"
                      >
                        Professor
                      </Button>
                    </div>
                  </div>
                  {isProfessor && (
                    <div className="space-y-2">
                      <Label htmlFor="username">Username (seu @)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                        <Input
                          id="username"
                          type="text"
                          placeholder="seunome"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="pl-8"
                          required
                          minLength={3}
                        />
                      </div>
                      {username && username.length >= 3 && (
                        <p className={`text-sm ${checkingUsername ? 'text-muted-foreground' : usernameAvailable ? 'text-green-600' : 'text-red-600'}`}>
                          {checkingUsername ? 'Verificando...' : usernameAvailable ? '✓ Disponível!' : '✗ Já está em uso'}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Apenas letras, números e _ (mínimo 3 caracteres)
                      </p>
                    </div>
                  )}
                </>
              )}
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
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? (isSignUp ? "Criando conta..." : "Entrando...") : (isSignUp ? "Criar Conta" : "Entrar")}
              </Button>
              <div className="text-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setIsSignUp(!isSignUp)}
                  className="text-sm"
                >
                  {isSignUp ? "Já tem uma conta? Entre aqui" : "Não tem conta? Crie uma"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
