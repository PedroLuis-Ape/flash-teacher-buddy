import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface SignupFormProps {
  initialAccountType?: "student" | "teacher";
  onSuccess?: (route?: string) => void;
  onLogin?: () => void;
}

function sanitizePublicSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function SignupForm({ initialAccountType, onSuccess, onLogin }: SignupFormProps) {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [isProfessor, setIsProfessor] = useState(initialAccountType === "teacher");
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialAccountType) setIsProfessor(initialAccountType === "teacher");
  }, [initialAccountType]);

  useEffect(() => {
    const cleanUsername = sanitizePublicSlug(username);
    if (!isProfessor || cleanUsername.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      setCheckingUsername(true);
      const { data, error } = await supabase.rpc(
        "is_public_slug_available_v1" as never,
        { p_slug: cleanUsername } as never,
      );

      setUsernameAvailable(!error && data === true);
      setCheckingUsername(false);
    }, 500);

    return () => window.clearTimeout(timer);
  }, [username, isProfessor]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const cleanUsername = isProfessor ? sanitizePublicSlug(username) : null;
    if (isProfessor && (!cleanUsername || cleanUsername.length < 3)) {
      toast.error("O username deve ter pelo menos 3 caracteres válidos.");
      return;
    }
    if (isProfessor && usernameAvailable !== true) {
      toast.error(checkingUsername ? "Aguarde a verificação do username." : "Escolha um username disponível.");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?flow=signup`,
          data: {
            first_name: firstName.trim(),
            requested_account_type: isProfessor ? "teacher" : "student",
            requested_public_slug: cleanUsername,
          },
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Não foi possível criar a conta.");

      if (data.session) {
        toast.success("Conta criada com sucesso!");
        onSuccess?.(isProfessor ? "/painel-professor" : "/dashboard");
      } else {
        toast.success("Conta criada. Confira seu e-mail para confirmar o acesso.");
        onLogin?.();
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Não foi possível criar a conta.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const sanitizedUsernameLength = sanitizePublicSlug(username).length;

  return (
    <div className="w-full">
      <div className="mb-6 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Criar sua conta</h1>
        <p className="mt-2 text-sm text-muted-foreground">Escolha seu perfil e comece a estudar ou ensinar.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="signup-name">Nome</Label>
          <Input id="signup-name" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="name" required />
        </div>

        <div className="space-y-2">
          <Label>Tipo de conta</Label>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant={isProfessor ? "outline" : "default"} onClick={() => setIsProfessor(false)}>Aluno</Button>
            <Button type="button" variant={isProfessor ? "default" : "outline"} onClick={() => setIsProfessor(true)}>Professor</Button>
          </div>
        </div>

        {isProfessor && (
          <div className="space-y-2">
            <Label htmlFor="signup-username">Username público</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
              <Input id="signup-username" value={username} onChange={(event) => setUsername(event.target.value)} className="pl-8" minLength={3} autoComplete="username" required />
            </div>
            {sanitizedUsernameLength >= 3 && (
              <p className={cn("text-xs", checkingUsername ? "text-muted-foreground" : usernameAvailable ? "text-emerald-600" : "text-destructive")}>
                {checkingUsername ? "Verificando..." : usernameAvailable ? "Disponível" : "Já está em uso"}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="signup-email">E-mail</Label>
          <Input id="signup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="signup-password">Senha</Label>
          <Input id="signup-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" minLength={6} required />
          <p className="text-xs text-muted-foreground">Use pelo menos 6 caracteres.</p>
        </div>

        <Button type="submit" className="h-11 w-full" disabled={loading || checkingUsername}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {loading ? "Criando conta..." : "Criar conta"}
        </Button>

        <Button type="button" variant="link" className="h-auto w-full py-1 text-sm" onClick={onLogin} disabled={loading}>
          Já tem uma conta? Entrar
        </Button>
      </form>
    </div>
  );
}
