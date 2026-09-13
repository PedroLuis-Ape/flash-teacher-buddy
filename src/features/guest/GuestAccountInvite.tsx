import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/useAuthUser";
import { hasGuestState } from "@/features/guest/guestStateBridge";

const DISMISS_KEY = "ape:guest-account-invite-dismissed:v1";

function wasDismissed() {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Convite nao bloqueante para criar conta, exibido apenas para visitante que
 * ja estudou neste dispositivo (tem estado local de guest). Nao interrompe o
 * primeiro jogo: so aparece depois que existe progresso real a preservar.
 */
export function GuestAccountInvite() {
  const { t } = useTranslation();
  const { userId, isLoading } = useAuthUser();
  const [dismissed, setDismissed] = useState(() => wasDismissed());

  if (isLoading || userId || dismissed) return null;
  if (!hasGuestState()) return null;

  const dismiss = () => {
    try {
      window.sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Sem storage o convite volta na proxima visita — comportamento aceitavel.
    }
    setDismissed(true);
  };

  return (
    <section
      className="mt-8 rounded-2xl border border-primary/25 bg-primary/5 p-4"
      aria-label={t("guestMerge.inviteTitle")}
      data-testid="guest-account-invite"
    >
      <h2 className="text-base font-semibold">{t("guestMerge.inviteTitle")}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("guestMerge.inviteBody")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button asChild className="w-auto">
          <Link to="/auth">{t("guestMerge.inviteCta")}</Link>
        </Button>
        <Button variant="ghost" className="w-auto" onClick={dismiss}>
          {t("guestMerge.inviteDismiss")}
        </Button>
      </div>
    </section>
  );
}

