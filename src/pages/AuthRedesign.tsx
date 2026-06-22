import { useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { PitecoLogo } from "@/features/gamification/components/PitecoLogo";
import { QuickLoginForm } from "@/features/auth/components/QuickLoginForm";
import { SignupForm } from "@/features/auth/components/SignupForm";
import { formatVersionShort } from "@/lib/versionManager";

export default function AuthRedesign() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode = searchParams.get("mode") === "signup" ? "signup" : "login";
  const requestedRole = searchParams.get("role") === "teacher"
    ? "teacher"
    : searchParams.get("role") === "student"
      ? "student"
      : undefined;

  useEffect(() => {
    const logoutFlag = Boolean(sessionStorage.getItem("logoutInProgress"));
    if (!logoutFlag) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) navigate("/dashboard", { replace: true });
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/dashboard", { replace: true });
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const setMode = (nextMode: "login" | "signup") => {
    const nextParams = new URLSearchParams(searchParams);
    if (nextMode === "signup") nextParams.set("mode", "signup");
    else nextParams.delete("mode");
    setSearchParams(nextParams, { replace: true });
  };

  const handleSuccess = () => navigate("/dashboard", { replace: true });

  return (
    <main className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-background px-4 py-8 sm:px-6">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/10 to-transparent" />

      <Link
        to="/"
        className="absolute left-4 top-4 z-10 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground sm:left-6 sm:top-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar
      </Link>

      <div className="relative z-10 w-full max-w-md">
        <Card className="border-border bg-card p-5 shadow-xl sm:p-7">
          <div className="mb-4 flex justify-center">
            <PitecoLogo className="h-14 w-14" />
          </div>

          {mode === "signup" ? (
            <SignupForm
              initialAccountType={requestedRole}
              onSuccess={handleSuccess}
              onLogin={() => setMode("login")}
            />
          ) : (
            <QuickLoginForm onSuccess={handleSuccess} onCreateAccount={() => setMode("signup")} />
          )}
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          APE · {formatVersionShort()}
        </p>
      </div>
    </main>
  );
}
