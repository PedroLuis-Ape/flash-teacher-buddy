import { forwardRef, MouseEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";

interface AuthAwareCTAProps extends Omit<ButtonProps, "onClick"> {
  /** Destino quando o usuário JÁ está logado. Default: "/dashboard" */
  authedTo?: string;
  /** Destino quando o usuário NÃO está logado. Default: "/auth" */
  guestTo?: string;
  children: ReactNode;
}

/**
 * Botão público "Entrar" / "Começar agora" / "Criar acesso".
 * Decide o destino com base na sessão atual do Supabase (via useAuthUser,
 * que já lê otimisticamente do localStorage gerido pelo próprio Supabase).
 * Não cria persistência própria nem força logout.
 */
export const AuthAwareCTA = forwardRef<HTMLButtonElement, AuthAwareCTAProps>(
  ({ authedTo = "/dashboard", guestTo = "/auth", children, ...props }, ref) => {
    const navigate = useNavigate();
    const { user } = useAuthUser();

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      e.preventDefault();
      navigate(user ? authedTo : guestTo);
    };

    return (
      <Button ref={ref} onClick={handleClick} {...props}>
        {children}
      </Button>
    );
  }
);
AuthAwareCTA.displayName = "AuthAwareCTA";