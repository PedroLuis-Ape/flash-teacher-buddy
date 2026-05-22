import { forwardRef, MouseEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthUser } from "@/hooks/useAuthUser";
import { Button, type ButtonProps } from "@/components/ui/button";

/**
 * SmartCTA — CTA reutilizável, session-aware.
 *
 * Destinos suportados:
 *  - "app"     : logado → authedTo (/dashboard), deslogado → guestTo (/auth)
 *  - "auth"    : sempre vai para /auth (ou guestTo)
 *  - "public"  : sempre navega para `to` (rota pública)
 *
 * Para variar o rótulo conforme a sessão, use `authedLabel` (logado) +
 * `children`/`label` (estado padrão / deslogado). Não há persistência manual:
 * a sessão vem do useAuthUser, que lê do storage gerido pelo Supabase.
 */

export type SmartCTADestination = "app" | "auth" | "public";
export type SmartCTAPlacement = "hero" | "section" | "nav" | "sticky" | "inline";

export interface SmartCTAProps extends Omit<ButtonProps, "children"> {
  destination?: SmartCTADestination;
  /** Rota usada quando destination = "public". */
  to?: string;
  /** Destino quando logado e destination = "app". Default: /dashboard */
  authedTo?: string;
  /** Destino quando deslogado e destination = "app" | "auth". Default: /auth */
  guestTo?: string;
  /** Rótulo padrão (deslogado, ou ambos se authedLabel não for passado). */
  label?: ReactNode;
  /** Rótulo alternativo para usuário logado. */
  authedLabel?: ReactNode;
  /** Permite override total via children (ignora label). */
  children?: ReactNode;
  /** Apenas semântica / data-attribute para futura instrumentação. */
  placement?: SmartCTAPlacement;
}

export const SmartCTA = forwardRef<HTMLButtonElement, SmartCTAProps>(
  (
    {
      destination = "app",
      to,
      authedTo = "/dashboard",
      guestTo = "/auth",
      label,
      authedLabel,
      children,
      onClick,
      placement,
      ...props
    },
    ref
  ) => {
    const navigate = useNavigate();
    const { user } = useAuthUser();
    const isAuthed = Boolean(user);

    const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;
      e.preventDefault();

      if (destination === "public") {
        navigate(to || "/");
        return;
      }
      if (destination === "auth") {
        navigate(isAuthed ? authedTo : guestTo);
        return;
      }
      // destination === "app"
      navigate(isAuthed ? authedTo : guestTo);
    };

    const content =
      children ?? (isAuthed && authedLabel ? authedLabel : label);

    return (
      <Button
        ref={ref}
        onClick={handleClick}
        data-cta-placement={placement}
        data-cta-destination={destination}
        {...props}
      >
        {content}
      </Button>
    );
  }
);
SmartCTA.displayName = "SmartCTA";

export default SmartCTA;