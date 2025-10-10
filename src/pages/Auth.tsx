import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PitecoMascot } from "@/components/PitecoMascot";
import { PitecoLogo } from "@/components/PitecoLogo";

const Auth = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) {
      toast.error("Por favor, preencha seu primeiro nome");
      return;
    }
    
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          first_name: firstName.trim(),
        },
      },
    });

    if (error) {
      if (error.message.includes("already registered") || error.message.includes("already been registered")) {
        toast.error("Este e-mail já está em uso");
      } else {
        toast.error(error.message);
      }
    } else if (data.user) {
      // Create or update profile with first name
      const ownerEmail = import.meta.env.VITE_OWNER_EMAIL;
      const isOwner = email.toLowerCase() === ownerEmail?.toLowerCase();
      
      await supabase.from("profiles").upsert({
        id: data.user.id,
        email: email,
        first_name: firstName.trim(),
        role: isOwner ? "owner" : "student",
        is_primary: isOwner,
      });
      
      toast.success("Conta criada! Você já pode fazer login.");
      setEmail("");
      setPassword("");
      setFirstName("");
    }
    setLoading(false);
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      setLoading(false);
    } else if (data.user) {
      // Bootstrap owner profile if needed
      const ownerEmail = import.meta.env.VITE_OWNER_EMAIL;
      const isOwner = email.toLowerCase() === ownerEmail?.toLowerCase();
      
      if (isOwner) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          email: data.user.email,
          first_name: import.meta.env.VITE_OWNER_FIRST_NAME || "Pedro",
          role: "owner",
          is_primary: true,
        });
      }
      
      toast.success("Login realizado!");
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary via-primary-glow to-accent flex items-center justify-center p-4 relative overflow-hidden">
      <PitecoMascot />
      
      <div className="w-full max-w-md space-y-6 relative z-20">
        {/* Welcome Card */}
        <Card className="p-6 shadow-[var(--shadow-card)] bg-card/95 backdrop-blur">
          <div className="flex flex-col items-center text-center">
            <PitecoLogo className="h-24 w-24 mb-4" />
            <h1 className="text-4xl font-bold mb-2">Bem-vindo à APE! 🎓</h1>
            <p className="text-muted-foreground text-lg">
              Apprenticeship Practice and Enhancement
            </p>
          </div>
        </Card>

        {/* Student Access Card */}
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

        {/* Teacher Login/Signup Card */}
        <Card className="p-6 shadow-[var(--shadow-card)] bg-card/95 backdrop-blur">
          <h2 className="text-2xl font-bold text-center mb-2">Área do Professor</h2>
          <p className="text-center text-muted-foreground mb-4">
            Gerencie suas coleções e compartilhe com alunos
          </p>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Criar Conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <form onSubmit={handleSignIn} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">Senha</Label>
                <Input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignUp} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="signup-firstname">Primeiro Nome *</Label>
                <Input
                  id="signup-firstname"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Seu primeiro nome"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email *</Label>
                <Input
                  id="signup-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha *</Label>
                <Input
                  id="signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Criando conta..." : "Criar Conta"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
