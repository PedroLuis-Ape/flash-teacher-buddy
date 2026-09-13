import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  discardGuestState,
  hasGuestState,
  importGuestStateToAccount,
  markGuestMergeDecision,
  readGuestMergeDecision,
} from "@/features/guest/guestStateBridge";
import { trackProductEvent, trackProductEventOnce } from "@/lib/productEvents";

/**
 * Pergunta unica e nao bloqueante ao entrar com estado de visitante no
 * dispositivo. Sem resposta, o dispositivo vence (politica definida no plano).
 */
export function GuestStateMergePrompt() {
  const { t } = useTranslation();
  const { userId } = useAuthUser();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (readGuestMergeDecision(userId)) return;
    if (!hasGuestState()) return;
    void trackProductEventOnce(`guest-resume:${userId}`, "guest_resume", {}, { surface: "guest-merge" });
    void trackProductEventOnce(`signup-cta:${userId}`, "signup_sync_cta_view", {}, { surface: "guest-merge" });
    setOpen(true);
  }, [userId]);

  if (!userId) return null;

  const apply = (decision: "device" | "account") => {
    if (decision === "device") {
      const result = importGuestStateToAccount(userId);
      toast.success(
        result.importedPresets > 0
          ? t("guestMerge.deviceApplied", { count: result.importedPresets })
          : t("guestMerge.nothingToImport"),
      );
    } else {
      discardGuestState();
      toast.success(t("guestMerge.accountKept"));
    }
    markGuestMergeDecision(userId, decision);
    void trackProductEvent("signup_after_guest", { outcome: decision }, { surface: "guest-merge" });
    setOpen(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={(next) => { if (!next) apply("device"); }}>
      <AlertDialogContent data-testid="guest-merge-prompt">
        <AlertDialogHeader>
          <AlertDialogTitle>{t("guestMerge.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("guestMerge.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => apply("account")}>
            {t("guestMerge.keepAccount")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => apply("device")}>
            {t("guestMerge.useDevice")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

