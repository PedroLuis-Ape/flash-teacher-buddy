import { forwardRef, MouseEvent, ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";
import { AuthDialog } from "@/features/auth/components/AuthDialog";
import { QuickLoginForm } from "@/features/auth/components/QuickLoginForm";

interface AuthAwareCTAProps extends ButtonProps {
  /** Destino quando o usuário JÁ está logado. Default: "/dashboard" */
  authedTo?: string;
  /** Destino quando o usuário NÃO está logado. Default: "/auth" */
  guestTo?: string;
  /** Login abre modal no desktop; cadastro continua na rota dedicada. */
  guestMode?: "login" | "signup";
  children: ReactNode;
}

/**
 * CTA público com comportamento responsivo:
 * - usuário autenticado: navega para o aplicativo;
 * - visitante no desktop: login abre um modal compacto;
 * - visitante no mobile: usa a página /auth;
 * - cadastro: usa a página completa para acomodar todos os campos.
 */
export const AuthAwareCTA = forwardRef<HTMLButtonElement, AuthAwareCTAProps>(
  (
    {
      authedTo = "/dashboard",
      guestTo = "/auth",
      guestMode = "login",
      children,
      onClick,
      ...props
    },
    ref,
  ) => {
    const navigate = useNavigate();
    const { user } = useAuthUser();
    const isMobile = useIsMobile();
    const [dialogOpen, setDialogOpen] = useState(false);

    const guestDestination = guestMode === "signup"
      ? `${guestTo}${guestTo.includes("?") ? "&" : "?"}mode=signup`
      : guestTo;

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;
      event.preventDefault();

      if (user) {
        navigate(authedTo);
        return;
      }

      const canUseDesktopDialog = !isMobile && guestMode === "login" && guestTo === "/auth";
      if (canUseDesktopDialog) {
        setDialogOpen(true);
        return;
      }

      navigate(guestDestination);
    };

    const handleLoginSuccess = () => {
      setDialogOpen(false);
      navigate(authedTo);
    };

    const handleCreateAccount = () => {
      setDialogOpen(false);
      navigate("/auth?mode=signup");
    };

    return (
      <>
        <Button ref={ref} onClick={handleClick} {...props}>
          {children}
        </Button>

        {!user && guestMode === "login" && (
          <AuthDialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <QuickLoginForm
              onSuccess={handleLoginSuccess}
              onCreateAccount={handleCreateAccount}
            />
          </AuthDialog>
        )}
      </>
    );
  },
);

AuthAwareCTA.displayName = "AuthAwareCTA";
