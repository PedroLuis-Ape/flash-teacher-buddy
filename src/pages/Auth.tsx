import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PitecoMascot } from "@/features/gamification/components/PitecoMascot";
import { PitecoLogo } from "@/features/gamification/components/PitecoLogo";
import { toast } from "sonner";
import { Download, Chrome } from "lucide-react";
import { formatVersionShort } from "@/lib/versionManager";
import { Separator } from "@/components/ui/separator";
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
  }>;
}
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
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
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
    // Sessão: a Supabase é a fonte da verdade. Se já existe sessão válida
    // (persistida nativamente pelo client), redireciona para a home.
    // Não dependemos mais de flags frágeis em sessionStorage (authReady).
    const logoutFlag = !!sessionStorage.getItem('logoutInProgress');
    if (!logoutFlag) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          navigate('/dashboard', { replace: true });
        }
      });
    }

    // Também escuta mudanças de auth para casos de login concluído por OAuth
    // ou refresh de token enquanto a tela /auth está aberta.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        navigate('/dashboard', { replace: true });
      }
    });

    // Detecta se o app pode ser instalado
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // Verifica se já está instalado
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      subscription.unsubscribe();
    };
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
      const {
        data,
        error
      } = await supabase.from('profiles').select('public_slug').eq('public_slug', cleanUsername).maybeSingle();
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
        const {
          data,
          error
        } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`
          }
        });
        if (error) throw error;
        if (data.user) {
          const cleanUsername = isProfessor ? username.toLowerCase().replace(/[^a-z0-9_]/g, '') : null;

          // O trigger handle_new_user já cria o perfil básico
          // Atualizamos campos adicionais via security definer function
          const { error: profileError } = await supabase.rpc('update_own_profile', {
            p_user_id: data.user.id,
            p_first_name: firstName,
            p_public_slug: cleanUsername,
            p_public_access_enabled: isProfessor,
            p_is_teacher: isProfessor,
            p_user_type: isProfessor ? 'professor' : 'aluno'
          });
          if (profileError) throw profileError;

          // Inserir role - o trigger assign_default_role já deve ter criado, mas garantimos aqui
          const {
            error: roleError
          } = await supabase.from('user_roles').insert({
            user_id: data.user.id,
            role: 'student'
          });

          // Ignorar erro se já existir (trigger já criou)
          if (roleError && !roleError.message?.includes('duplicate') && !roleError.code?.includes('23505')) {
            console.error('Erro ao criar role:', roleError);
          }
          toast.success(`Conta criada com sucesso! ${isProfessor ? `Seu @ é: @${cleanUsername}` : 'Bem-vindo!'}`);
        }
      } else {
        // Sign in
        const {
          data,
          error
        } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        if (data.user) {
          // Get user profile for welcome message
          const {
            data: profile
          } = await supabase.from('profiles').select('first_name').eq('id', data.user.id).maybeSingle();
          toast.success(`Bem-vindo${profile?.first_name ? `, ${profile.first_name}` : ''}!`);
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
      // Redirect happens automatically
    } catch (error: any) {
      toast.error(error.message || "Erro ao conectar com Google");
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const {
        outcome
      } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        toast.success("App instalado com sucesso!");
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isInstalled) {
      toast.info("O app já está instalado!");
    } else {
      // Instruções para instalação manual
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        toast.info("No Safari, toque em 'Compartilhar' → 'Adicionar à Tela de Início'");
      } else {
        toast.info("Use o menu do navegador para instalar o app");
      }
    }
  };
  return <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "var(--gradient-auth)" }}
    >
      {/* Decorative ambient glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 w-[420px] h-[420px] rounded-full opacity-40 blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--primary-glow)) 0%, transparent 70%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-32 w-[460px] h-[460px] rounded-full opacity-30 blur-3xl"
        style={{ background: "radial-gradient(circle, hsl(var(--accent)) 0%, transparent 70%)" }}
      />

      <PitecoMascot />

      {/* Download button - fixed position */}
      {!isInstalled && <Button onClick={handleDownload} className="fixed top-4 right-4 z-50 gap-2 shadow-lg" size="lg">
          <Download className="w-5 h-5" />
          Download
        </Button>}

      <div className="w-full max-w-md space-y-5 relative z-20">
        <Card
          className="p-6 border-white/10 bg-card/80 backdrop-blur-xl"
          style={{ boxShadow: "var(--shadow-glow), var(--shadow-card)" }}
        >
          <div className="flex flex-col items-center text-center">
            <PitecoLogo className="h-24 w-24 mb-4 drop-shadow-[0_4px_24px_hsl(var(--primary-glow)/0.55)]" />
            <h1 className="text-3xl sm:text-4xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-primary-foreground to-primary-glow">
              Bem-vindo à APE
            </h1>
            <p className="text-muted-foreground text-base sm:text-lg">
              Apprentice Practice & Enhancement
            </p>
          </div>
        </Card>

        {/* Version Badge */}
        <div className="flex justify-center">
          <div className="bg-white/10 backdrop-blur-sm px-5 py-1.5 rounded-full border border-white/15 shadow-md">
            <p className="text-xs font-medium tracking-wide text-white/85">
              {formatVersionShort()}
            </p>
          </div>
        </div>

        <Card
          className="w-full max-w-md bg-card/85 backdrop-blur-xl border-white/10"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <CardHeader>
            <CardTitle className="text-2xl">{isSignUp ? "Criar Conta" : "Entrar"}</CardTitle>
            <CardDescription>
              {isSignUp ? "Preencha seus dados para criar uma conta" : "Entre com suas credenciais"}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            {/* Google Sign In Button - Show only for login */}
            {!isSignUp && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="w-full max-w-md gap-2 min-h-[48px]"
                >
                  <Chrome className="h-5 w-5" />
                  Continuar com Google
                </Button>
                
                <div className="flex items-center gap-4 w-full max-w-md my-4">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">ou</span>
                  <Separator className="flex-1" />
                </div>
              </>
            )}

            <form onSubmit={handleAuth} className="space-y-4 w-full max-w-md">
              {isSignUp && <>
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Nome</Label>
                    <Input id="firstName" type="text" placeholder="Seu nome" value={firstName} onChange={e => setFirstName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo de conta</Label>
                    <div className="flex gap-4">
                      <Button type="button" variant={!isProfessor ? "default" : "outline"} onClick={() => setIsProfessor(false)} className="flex-1">
                        Aluno
                      </Button>
                      <Button type="button" variant={isProfessor ? "default" : "outline"} onClick={() => setIsProfessor(true)} className="flex-1">
                        Professor
                      </Button>
                    </div>
                  </div>
                  {isProfessor && <div className="space-y-2">
                      <Label htmlFor="username">Username (seu @)</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                        <Input id="username" type="text" placeholder="seunome" value={username} onChange={e => setUsername(e.target.value)} className="pl-8" required minLength={3} />
                      </div>
                      {username && username.length >= 3 && <p className={`text-sm ${checkingUsername ? 'text-muted-foreground' : usernameAvailable ? 'text-green-600' : 'text-red-600'}`}>
                          {checkingUsername ? 'Verificando...' : usernameAvailable ? '✓ Disponível!' : '✗ Já está em uso'}
                        </p>}
                      <p className="text-xs text-muted-foreground">
                        Apenas letras, números e _ (mínimo 3 caracteres)
                      </p>
                    </div>}
                </>}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
              </div>
              <div className="flex justify-center w-full">
                <Button type="submit" className="w-full max-w-xs" size="lg" disabled={loading}>
                  {loading ? isSignUp ? "Criando conta..." : "Entrando..." : isSignUp ? "Criar Conta" : "Entrar"}
                </Button>
              </div>
              <div className="flex justify-center w-full">
                <Button type="button" variant="link" onClick={() => setIsSignUp(!isSignUp)} className="text-sm">
                  {isSignUp ? "Já tem uma conta? Entre aqui" : "Não tem conta? Crie uma"}
                </Button>
              </div>
              <div className="flex justify-center w-full pt-1">
                <Link
                  to="/landing"
                  className="text-xs text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  ← Voltar para a página inicial
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>;
};
export default Auth;