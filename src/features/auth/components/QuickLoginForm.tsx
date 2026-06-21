import { useState } from "react";
import { Chrome, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface QuickLoginFormProps {
  onSuccess?: () => void;
  onCreateAccount?: () => void;
}

export function QuickLoginForm({ onSuccess, onCreateAccount }: QuickLoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      toast.error(error.message || "Não foi possível entrar com Google.");
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Login realizado com sucesso.");
      onSuccess?.();
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível entrar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full text-center">
      <div className="mb-5 text-center">
        <h2 className="text-2xl font-bold tracking-tight">Entrar na APE</h2>
        <p className="mt-2 text-sm text-muted-foreground">Acesse seus materiais e continue de onde parou.</p>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleGoogle}
        disabled={loading}
        className="mx-auto h-11 min-w-[230px] justify-center gap-2"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Chrome className="h-4 w-4" />}
        Continuar com Google
      </Button>

      <div className="mx-auto my-4 flex max-w-sm items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground">ou</span>
        <Separator className="flex-1" />
      </div>

      <form onSubmit={handleSubmit} className="mx-auto max-w-sm space-y-4 text-center">
        <div className="space-y-2 text-center">
          <Label htmlFor="quick-login-email" className="block text-center">E-mail</Label>
          <Input
            id="quick-login-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className="text-center"
            required
          />
        </div>
        <div className="space-y-2 text-center">
          <Label htmlFor="quick-login-password" className="block text-center">Senha</Label>
          <Input
            id="quick-login-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            className="text-center"
            required
          />
        </div>
        <Button type="submit" className="mx-auto h-11 min-w-[150px] justify-center" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Entrar
        </Button>
      </form>

      <Button
        type="button"
        variant="link"
        className="mx-auto mt-3 h-auto py-1 text-center text-sm"
        onClick={onCreateAccount}
      >
        Não tem conta? Criar uma
      </Button>
    </div>
  );
}
